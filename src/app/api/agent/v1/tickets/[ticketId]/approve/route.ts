import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAgent, verifyProjectOwnerOrPM } from '@/lib/agent-auth';
import { fireWebhooks } from '@/lib/webhooks';
import { notifyDeliverableApproved } from '@/lib/email';
import { COMMISSION_RATE } from '@/lib/constants';

// POST /api/agent/v1/tickets/[ticketId]/approve — Approve/reject/revise a ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { ticketId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId)) {
    return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
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

  // Fetch ticket (include deliverables for hash verification)
  const { data: ticket, error: ticketError } = await admin
    .from('tickets')
    .select('id, project_id, title, status, assignee_agent_key_id, ticket_number, deliverables')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // Verify agent is project owner or PM
  const isAuthorized = await verifyProjectOwnerOrPM(auth.agentKeyId, ticket.project_id);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Only the project owner or PM can approve tickets' },
      { status: 403 }
    );
  }

  // Validate ticket status
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
    const commissionCents = Math.round(payoutCents * COMMISSION_RATE);

    // Update ticket
    await admin
      .from('tickets')
      .update({
        approval_status: 'approved',
        payout_cents: payoutCents,
        approved_at: now,
        approved_by: auth.agentKeyId,
      })
      .eq('id', ticketId);

    // Create transaction record
    if (payoutCents > 0) {
      await admin.from('transactions').insert({
        project_id: ticket.project_id,
        ticket_id: ticketId,
        amount_cents: payoutCents,
        commission_cents: commissionCents,
        type: 'deliverable_approved',
        description: comment || `Approved ticket #${ticket.ticket_number}: ${ticket.title}`,
      });
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
        const { data: project } = await admin
          .from('projects')
          .select('title')
          .eq('id', ticket.project_id)
          .single();

        notifyDeliverableApproved(
          agentKey.owner_id,
          agentKey.name,
          ticket.title,
          ticket.ticket_number,
          payoutCents,
          project?.title || 'Unknown project',
        ).catch(() => {});
      }
    }

    // Count verified deliverable hashes
    const deliverables = (ticket.deliverables as Array<{ content_hash?: string }>) || [];
    const verifiedHashes = deliverables.filter(d => d.content_hash).length;

    return NextResponse.json({
      data: {
        ticket_id: ticketId,
        action: 'approved',
        payout_cents: payoutCents,
        commission_cents: commissionCents,
        net_payout_cents: payoutCents - commissionCents,
        verified_hashes: verifiedHashes,
        total_deliverables: deliverables.length,
      },
    });
  }

  if (action === 'reject') {
    await admin
      .from('tickets')
      .update({ approval_status: 'rejected' })
      .eq('id', ticketId);

    if (ticket.assignee_agent_key_id) {
      fireWebhooks(admin, 'deliverable_rejected', [ticket.assignee_agent_key_id], {
        ticket_id: ticketId,
        ticket_number: ticket.ticket_number,
        title: ticket.title,
        comment,
      });
    }

    return NextResponse.json({
      data: { ticket_id: ticketId, action: 'rejected', comment },
    });
  }

  // action === 'revise'
  await admin
    .from('tickets')
    .update({
      approval_status: 'revision_requested',
      status: 'in_progress',
    })
    .eq('id', ticketId);

  if (ticket.assignee_agent_key_id) {
    fireWebhooks(admin, 'deliverable_rejected', [ticket.assignee_agent_key_id], {
      ticket_id: ticketId,
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      action: 'revision_requested',
      comment,
    });
  }

  return NextResponse.json({
    data: { ticket_id: ticketId, action: 'revision_requested', comment },
  });
}
