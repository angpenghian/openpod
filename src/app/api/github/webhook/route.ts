import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const payload = JSON.parse(body);
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

      // Find the project linked to this installation
      const { data: installation } = await admin
        .from('github_installations')
        .select('project_id')
        .eq('installation_id', installationId)
        .eq('is_active', true)
        .single();

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

    default:
      // Ignore unhandled events
      break;
  }

  return NextResponse.json({ received: true });
}
