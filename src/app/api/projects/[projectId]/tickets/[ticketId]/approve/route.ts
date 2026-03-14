import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { fireWebhooks } from '@/lib/webhooks';
import { notifyDeliverableApproved } from '@/lib/email';
import { COMMISSION_RATE } from '@/lib/constants';
import { settleStripeTransfer } from '@/lib/stripe';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/projects/[projectId]/tickets/[ticketId]/approve
// Human-side ticket approval (cookie auth) — fixes duplicate transaction bug
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; ticketId: string }> }
) {
  const { projectId, ticketId } = await params;

  if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(ticketId)) {
    return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
  }

  // Cookie-based auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, payout_cents, comment } = body as {
    action?: string; payout_cents?: number; comment?: string;
  };

  if (!action || !['approve', 'reject', 'revise'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve, reject, or revise' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user owns the project
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, owner_id, title, escrow_amount_cents, escrow_status')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Only the project owner can approve tickets' }, { status: 403 });
  }

  // Fetch ticket
  const { data: ticket, error: ticketError } = await admin
    .from('tickets')
    .select('id, project_id, title, status, approval_status, assignee_agent_key_id, ticket_number, deliverables')
    .eq('id', ticketId)
    .eq('project_id', projectId)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // C1: Prevent double-approval (creates duplicate transactions + Stripe transfers)
  if (ticket.approval_status === 'approved') {
    return NextResponse.json(
      { error: 'Ticket has already been approved' },
      { status: 409 }
    );
  }

  if (!['done', 'in_review'].includes(ticket.status)) {
    return NextResponse.json(
      { error: `Ticket must be in done or in_review status (currently: ${ticket.status})` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  if (action === 'approve') {
    if (payout_cents !== undefined && (typeof payout_cents !== 'number' || payout_cents < 0 || !Number.isInteger(payout_cents))) {
      return NextResponse.json({ error: 'payout_cents must be a non-negative integer' }, { status: 400 });
    }
    const payoutCents = payout_cents || 0;
    if (payoutCents <= 0) {
      return NextResponse.json({ error: 'payout_cents must be greater than 0 for approval' }, { status: 400 });
    }
    // H9: Upper bound on payout to prevent accidental or malicious escrow drain
    if (payoutCents > 10_000_000) {
      return NextResponse.json({ error: 'payout_cents cannot exceed 10,000,000 ($100,000)' }, { status: 400 });
    }
    const commissionCents = Math.round(payoutCents * COMMISSION_RATE);

    // H2: Update ticket and check result — do NOT proceed with money ops if update fails
    const { error: updateError } = await admin.from('tickets').update({
      status: 'done',
      approval_status: 'approved',
      payout_cents: payoutCents,
      approved_at: now,
      approved_by: user.id,
    }).eq('id', ticketId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
    }

    // Create transaction record (gross amount — matches agent API endpoint)
    let transactionId: string | null = null;
    if (payoutCents > 0) {
      // Find position_id and agent_registry_id via assignee's project membership
      let positionId: string | null = null;
      let agentRegistryId: string | null = null;
      if (ticket.assignee_agent_key_id) {
        const { data: member } = await admin
          .from('project_members')
          .select('position_id')
          .eq('project_id', projectId)
          .eq('agent_key_id', ticket.assignee_agent_key_id)
          .single();
        positionId = member?.position_id || null;

        // H2: Look up agent_registry_id for audit trail
        const { data: agentKey } = await admin
          .from('agent_keys')
          .select('registry_id')
          .eq('id', ticket.assignee_agent_key_id)
          .single();
        agentRegistryId = agentKey?.registry_id || null;
      }

      const { data: tx } = await admin.from('transactions').insert({
        project_id: projectId,
        position_id: positionId,
        ticket_id: ticketId,
        agent_registry_id: agentRegistryId,
        amount_cents: payoutCents,
        commission_cents: commissionCents,
        type: 'deliverable_approved',
        description: comment || `Approved: #${ticket.ticket_number} ${ticket.title}`,
      }).select('id').single();

      transactionId = tx?.id || null;

      // Attempt Stripe settlement if project is funded and agent is Stripe-onboarded
      // C3: Include 'partially_released' — after first payout, status changes from 'funded' to 'partially_released'
      if (transactionId && ['funded', 'partially_released'].includes(project.escrow_status) && project.escrow_amount_cents >= payoutCents) {
        const settled = await settleStripeTransfer(admin, transactionId, ticket.assignee_agent_key_id, payoutCents, commissionCents, project);
        if (!settled) {
          await admin.from('transactions').update({
            settled: false,
            payment_rail: 'ledger',
          }).eq('id', transactionId);
          console.warn(`Stripe transfer failed for tx ${transactionId}, falling back to ledger`);
        }
      } else if (transactionId) {
        // No escrow funds — mark as ledger
        await admin.from('transactions').update({
          settled: false,
          payment_rail: 'ledger',
        }).eq('id', transactionId);
      }
    }

    // Fire webhook to assigned agent
    if (ticket.assignee_agent_key_id) {
      fireWebhooks(admin, 'deliverable_approved', [ticket.assignee_agent_key_id], {
        ticket_id: ticketId,
        ticket_number: ticket.ticket_number,
        title: ticket.title,
        payout_cents: payoutCents,
        comment,
      });

      // Email the agent's owner
      const { data: agentKey } = await admin
        .from('agent_keys')
        .select('owner_id, name')
        .eq('id', ticket.assignee_agent_key_id)
        .single();

      if (agentKey) {
        notifyDeliverableApproved(
          agentKey.owner_id,
          agentKey.name,
          ticket.title,
          ticket.ticket_number,
          payoutCents,
          project.title,
        ).catch(() => {});
      }
    }

    return NextResponse.json({
      data: {
        ticket_id: ticketId,
        action: 'approved',
        payout_cents: payoutCents,
        commission_cents: commissionCents,
        net_payout_cents: payoutCents - commissionCents,
      },
    });
  }

  if (action === 'reject') {
    await admin.from('tickets').update({ approval_status: 'rejected' }).eq('id', ticketId);

    if (ticket.assignee_agent_key_id) {
      fireWebhooks(admin, 'deliverable_rejected', [ticket.assignee_agent_key_id], {
        ticket_id: ticketId,
        ticket_number: ticket.ticket_number,
        title: ticket.title,
        comment,
      });
    }

    return NextResponse.json({ data: { ticket_id: ticketId, action: 'rejected', comment } });
  }

  // action === 'revise'
  await admin.from('tickets').update({
    approval_status: 'revision_requested',
    status: 'in_progress',
  }).eq('id', ticketId);

  if (ticket.assignee_agent_key_id) {
    fireWebhooks(admin, 'deliverable_rejected', [ticket.assignee_agent_key_id], {
      ticket_id: ticketId,
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      action: 'revision_requested',
      comment,
    });
  }

  return NextResponse.json({ data: { ticket_id: ticketId, action: 'revision_requested', comment } });
}
