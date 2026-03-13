import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { fireWebhooks } from '@/lib/webhooks';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Verify GitHub webhook signature (HMAC-SHA256).
 */
function verifySignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * GitHub App webhook handler.
 * Receives events from GitHub when things happen in repos where the app is installed.
 *
 * Events handled:
 * - pull_request (opened, closed, merged) — update ticket status
 * - installation (created, deleted) — track app installation changes
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  const event = request.headers.get('x-github-event');

  // Verify webhook signature
  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event) {
    case 'installation': {
      if (payload.action === 'deleted') {
        // App was uninstalled — deactivate the installation record
        await admin
          .from('github_installations')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('installation_id', payload.installation.id);
      }
      break;
    }

    case 'pull_request': {
      const installationId = payload.installation?.id;
      if (!installationId) break;

      // Find the project linked to this installation (use maybeSingle to handle 0 or 1 result)
      const { data: installation } = await admin
        .from('github_installations')
        .select('project_id')
        .eq('installation_id', installationId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!installation) break;

      const prUrl = payload.pull_request?.html_url;
      const action = payload.action;

      if (action === 'closed' && payload.pull_request?.merged) {
        // PR was merged — find tickets with this PR as a deliverable and update
        const { data: tickets } = await admin
          .from('tickets')
          .select('id, deliverables, status')
          .eq('project_id', installation.project_id)
          .in('status', ['in_progress', 'in_review']);

        if (tickets) {
          for (const ticket of tickets) {
            const deliverables = ticket.deliverables as Array<{ url?: string }> | null;
            if (!deliverables) continue;
            const hasPR = deliverables.some(d => d.url === prUrl);
            if (hasPR && ticket.status === 'in_progress') {
              await admin
                .from('tickets')
                .update({ status: 'in_review', approval_status: 'pending_review' })
                .eq('id', ticket.id);
            }
          }
        }
      }
      break;
    }

    case 'check_run': {
      // CI check completed — notify agents with matching PR deliverables
      if (payload.action !== 'completed') break;

      const checkInstallationId = payload.installation?.id;
      if (!checkInstallationId) break;

      const { data: checkInstallation } = await admin
        .from('github_installations')
        .select('project_id')
        .eq('installation_id', checkInstallationId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!checkInstallation) break;

      // Get PR URLs from the check run
      const prUrls: string[] = (payload.check_run?.pull_requests || [])
        .map((pr: { html_url?: string; url?: string; number?: number }) => {
          // GitHub check_run.pull_requests has 'url' (API) not 'html_url'
          // Construct the HTML URL from repo + number
          if (pr.number && payload.repository?.html_url) {
            return `${payload.repository.html_url}/pull/${pr.number}`;
          }
          return pr.html_url || null;
        })
        .filter(Boolean) as string[];

      if (prUrls.length === 0) break;

      // Find tickets with matching PR deliverables and notify assigned agents
      const { data: ciTickets } = await admin
        .from('tickets')
        .select('id, assignee_agent_key_id, deliverables')
        .eq('project_id', checkInstallation.project_id)
        .in('status', ['in_progress', 'in_review']);

      if (ciTickets) {
        const affectedAgentKeys: string[] = [];
        for (const ticket of ciTickets) {
          const deliverables = ticket.deliverables as Array<{ url?: string }> | null;
          if (!deliverables) continue;
          const hasPR = deliverables.some(d => d.url && prUrls.includes(d.url));
          if (hasPR && ticket.assignee_agent_key_id) {
            affectedAgentKeys.push(ticket.assignee_agent_key_id);
          }
        }
        if (affectedAgentKeys.length > 0) {
          fireWebhooks(admin, 'ci_check_completed', affectedAgentKeys, {
            check_name: payload.check_run?.name,
            conclusion: payload.check_run?.conclusion,
            status: payload.check_run?.status,
            pr_urls: prUrls,
            project_id: checkInstallation.project_id,
          }).catch(() => {});
        }
      }
      break;
    }

    case 'pull_request_review': {
      // PR review submitted — notify assigned agent
      if (payload.action !== 'submitted') break;

      const reviewInstallationId = payload.installation?.id;
      if (!reviewInstallationId) break;

      const { data: reviewInstallation } = await admin
        .from('github_installations')
        .select('project_id')
        .eq('installation_id', reviewInstallationId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!reviewInstallation) break;

      const reviewPrUrl = payload.pull_request?.html_url;
      const reviewState = payload.review?.state; // 'approved', 'changes_requested', 'commented'

      if (!reviewPrUrl) break;

      // Find tickets with this PR as a deliverable
      const { data: reviewTickets } = await admin
        .from('tickets')
        .select('id, assignee_agent_key_id, deliverables')
        .eq('project_id', reviewInstallation.project_id)
        .in('status', ['in_progress', 'in_review']);

      if (reviewTickets) {
        const reviewAgentKeys: string[] = [];
        for (const ticket of reviewTickets) {
          const deliverables = ticket.deliverables as Array<{ url?: string }> | null;
          if (!deliverables) continue;
          const hasPR = deliverables.some(d => d.url === reviewPrUrl);
          if (hasPR && ticket.assignee_agent_key_id) {
            reviewAgentKeys.push(ticket.assignee_agent_key_id);
          }
        }
        if (reviewAgentKeys.length > 0) {
          fireWebhooks(admin, 'pr_review_submitted', reviewAgentKeys, {
            review_state: reviewState,
            reviewer: payload.review?.user?.login,
            pr_url: reviewPrUrl,
            pr_number: payload.pull_request?.number,
            body: payload.review?.body?.slice(0, 500),
            project_id: reviewInstallation.project_id,
          }).catch(() => {});
        }
      }
      break;
    }

    default:
      // Ignore unhandled events
      break;
  }

  return NextResponse.json({ received: true });
}
