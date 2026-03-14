import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAgent, verifyProjectOwnerOrPM } from '@/lib/agent-auth';
import { fireWebhooks } from '@/lib/webhooks';
import { notifyDeliverableApproved } from '@/lib/email';
import { COMMISSION_RATE } from '@/lib/constants';
import { settleStripeTransfer } from '@/lib/stripe';

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

  const { action, payout_cents, comment: rawComment } = body as {
    action?: string; payout_cents?: number; comment?: string;
  };
  const comment = typeof rawComment === 'string' ? rawComment.slice(0, 2000) : rawComment;

  if (!action || !['approve', 'reject', 'revise'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve, reject, or revise' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch ticket (include deliverables for hash verification)
  const { data: ticket, error: ticketError } = await admin
    .from('tickets')
    .select('id, project_id, title, status, approval_status, assignee_agent_key_id, ticket_number, deliverables')
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

  // Prevent self-approval: the approver cannot be the ticket assignee
  if (ticket.assignee_agent_key_id === auth.agentKeyId) {
    return NextResponse.json(
      { error: 'Cannot approve your own ticket. A different PM or the project owner must approve.' },
      { status: 403 }
    );
  }

  // C1: Prevent double-approval (creates duplicate transactions + Stripe transfers)
  if (ticket.approval_status === 'approved') {
    return NextResponse.json(
      { error: 'Ticket has already been approved' },
      { status: 409 }
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
    const payoutCents = payout_cents ?? 0;
    if (payoutCents <= 0) {
      return NextResponse.json({ error: 'payout_cents must be greater than 0 for approval' }, { status: 400 });
    }
    // H9: Upper bound on payout to prevent accidental or malicious escrow drain
    if (payoutCents > 10_000_000) {
      return NextResponse.json({ error: 'payout_cents cannot exceed 10,000,000 ($100,000)' }, { status: 400 });
    }
    const commissionCents = Math.round(payoutCents * COMMISSION_RATE);

    // C1+H5: Block approval of rejected tickets that haven't been reworked
    if (ticket.approval_status === 'rejected') {
      return NextResponse.json(
        { error: 'Ticket was rejected. Agent must rework (move to in_progress then back to in_review) before re-approval.' },
        { status: 400 }
      );
    }

    // C1: Atomic double-approval guard — WHERE neq prevents TOCTOU race
    const { data: updateResult, error: updateError } = await admin
      .from('tickets')
      .update({
        status: 'done',
        approval_status: 'approved',
        payout_cents: payoutCents,
        approved_at: now,
        approved_by: auth.agentKeyId,
      })
      .eq('id', ticketId)
      .neq('approval_status', 'approved')
      .select('id');

    if (updateError || !updateResult?.length) {
      return NextResponse.json({ error: 'Ticket already approved or concurrent conflict' }, { status: 409 });
    }

    // Create transaction record
    if (payoutCents > 0) {
      // H1+H2: Look up position_id and agent_registry_id for complete audit trail
      let positionId: string | null = null;
      let agentRegistryId: string | null = null;
      if (ticket.assignee_agent_key_id) {
        const { data: member } = await admin
          .from('project_members')
          .select('position_id')
          .eq('project_id', ticket.project_id)
          .eq('agent_key_id', ticket.assignee_agent_key_id)
          .single();
        positionId = member?.position_id || null;

        const { data: agentKey } = await admin
          .from('agent_keys')
          .select('registry_id')
          .eq('id', ticket.assignee_agent_key_id)
          .single();
        agentRegistryId = agentKey?.registry_id || null;
      }

      const { data: tx } = await admin.from('transactions').insert({
        project_id: ticket.project_id,
        position_id: positionId,
        ticket_id: ticketId,
        agent_registry_id: agentRegistryId,
        amount_cents: payoutCents,
        commission_cents: commissionCents,
        type: 'deliverable_approved',
        description: comment || `Approved ticket #${ticket.ticket_number}: ${ticket.title}`,
      }).select('id').single();

      // Attempt Stripe settlement if project is funded
      if (tx?.id) {
        const { data: project } = await admin
          .from('projects')
          .select('id, escrow_amount_cents, escrow_status')
          .eq('id', ticket.project_id)
          .single();

        // C3: Include 'partially_released' — after first payout, status changes from 'funded' to 'partially_released'
        if (project && ['funded', 'partially_released'].includes(project.escrow_status) && project.escrow_amount_cents >= payoutCents) {
          const settled = await settleStripeTransfer(admin, tx.id, ticket.assignee_agent_key_id, payoutCents, commissionCents, project);
          if (!settled) {
            // Graceful fallback: mark as ledger-only
            await admin.from('transactions').update({
              settled: false,
              payment_rail: 'ledger',
            }).eq('id', tx.id);
            console.warn(`Stripe transfer failed for tx ${tx.id}, falling back to ledger`);
          }
        } else if (tx?.id) {
          // No escrow funds — mark as ledger
          await admin.from('transactions').update({
            settled: false,
            payment_rail: 'ledger',
          }).eq('id', tx.id);
        }
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
