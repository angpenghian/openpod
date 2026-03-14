import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, verifyProjectMembership, getAgentMembership } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { VALID_TICKET_TRANSITIONS, type TicketStatus } from '@/lib/constants';
import { fireWebhooks } from '@/lib/webhooks';
import { notifyTicketCompleted } from '@/lib/email';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/agent/v1/tickets/[ticketId] — Get ticket detail with comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { ticketId } = await params;
  if (!UUID_REGEX.test(ticketId)) {
    return NextResponse.json({ data: null, error: 'Invalid ticket ID' }, { status: 400 });
  }
  const admin = createAdminClient();

  // Fetch ticket
  const { data: ticket, error: ticketError } = await admin
    .from('tickets')
    .select(`
      id, project_id, ticket_number, title, description, status, priority,
      ticket_type, acceptance_criteria, parent_ticket_id, branch, deliverables,
      story_points, assignee_agent_key_id, assignee_user_id,
      created_by_user_id, created_by_agent_key_id, labels, due_date,
      created_at, updated_at
    `)
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json(
      { data: null, error: 'Ticket not found' },
      { status: 404 }
    );
  }

  // Verify membership via ticket's project
  const membership = await verifyProjectMembership(auth.agentKeyId, ticket.project_id);
  if (!membership) {
    return NextResponse.json(
      { data: null, error: 'Not a member of this project' },
      { status: 403 }
    );
  }

  // Fetch comments
  const { data: comments } = await admin
    .from('ticket_comments')
    .select('id, ticket_id, author_user_id, author_agent_key_id, content, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    data: {
      ...ticket,
      comments: comments || [],
    },
  });
}

// PATCH /api/agent/v1/tickets/[ticketId] — Update ticket fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { ticketId } = await params;
  if (!UUID_REGEX.test(ticketId)) {
    return NextResponse.json({ data: null, error: 'Invalid ticket ID' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Fetch ticket to verify project membership + current status for transition/role validation
  const { data: ticket, error: ticketError } = await admin
    .from('tickets')
    .select('id, project_id, status, title, ticket_number, labels, assignee_agent_key_id')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json(
      { data: null, error: 'Ticket not found' },
      { status: 404 }
    );
  }

  const agentMembership = await getAgentMembership(auth.agentKeyId, ticket.project_id);
  if (!agentMembership) {
    return NextResponse.json(
      { data: null, error: 'Not a member of this project' },
      { status: 403 }
    );
  }

  // Whitelist updatable fields
  const allowedFields = [
    'title', 'description', 'status', 'priority', 'ticket_type',
    'acceptance_criteria', 'assignee_agent_key_id',
    'branch', 'deliverables', 'story_points', 'labels', 'due_date',
    'parent_ticket_id',
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { data: null, error: 'No valid fields to update' },
      { status: 400 }
    );
  }

  // Validate deliverables content_hash format (SHA-256 = 64 hex chars)
  if (updates.deliverables && Array.isArray(updates.deliverables)) {
    for (const d of updates.deliverables as Array<Record<string, unknown>>) {
      if (d.content_hash && typeof d.content_hash === 'string') {
        if (!/^[a-f0-9]{64}$/i.test(d.content_hash)) {
          return NextResponse.json(
            { data: null, error: 'content_hash must be a valid SHA-256 hex string (64 characters)' },
            { status: 400 }
          );
        }
      }
    }
  }

  // H7: Workers can only update their own tickets (or self-assign unassigned ones)
  if (agentMembership.roleLevel === 'worker') {
    const isOwnTicket = ticket.assignee_agent_key_id === auth.agentKeyId;
    const isSelfAssigning = !ticket.assignee_agent_key_id &&
      updates.assignee_agent_key_id === auth.agentKeyId;

    if (!isOwnTicket && !isSelfAssigning) {
      return NextResponse.json(
        { data: null, error: 'Workers can only update tickets assigned to them or self-assign unassigned tickets' },
        { status: 403 }
      );
    }
  }

  // Validate status enum + transition if provided
  if (updates.status) {
    const validStatuses = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'];
    if (!validStatuses.includes(updates.status as string)) {
      return NextResponse.json(
        { data: null, error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Enforce valid transitions
    const currentStatus = ticket.status as TicketStatus;
    const newStatus = updates.status as TicketStatus;
    const allowed = VALID_TICKET_TRANSITIONS[currentStatus];
    if (newStatus !== currentStatus && !allowed?.includes(newStatus)) {
      return NextResponse.json(
        { data: null, error: `Cannot transition from "${currentStatus}" to "${newStatus}". Valid transitions: ${allowed?.join(', ') || 'none'}` },
        { status: 400 }
      );
    }

    // C7: Role-based status transition enforcement
    if (newStatus !== currentStatus) {
      if (agentMembership.roleLevel === 'worker') {
        const workerAllowed: Record<string, string[]> = {
          'todo': ['in_progress'],
          'in_progress': ['in_review'],
        };
        if (!workerAllowed[currentStatus]?.includes(newStatus)) {
          return NextResponse.json(
            { data: null, error: 'Workers can only transition todo→in_progress or in_progress→in_review' },
            { status: 403 }
          );
        }
      } else if (agentMembership.roleLevel === 'lead') {
        if (currentStatus === 'in_review' && newStatus === 'done') {
          return NextResponse.json(
            { data: null, error: 'Leads cannot move tickets to done directly. Use the approval endpoint.' },
            { status: 403 }
          );
        }
      }
      // PMs: all valid transitions allowed (already validated above)
    }
  }

  // Validate priority enum if provided
  if (updates.priority) {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(updates.priority as string)) {
      return NextResponse.json(
        { data: null, error: `priority must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }
  }

  // Validate ticket_type enum if provided
  if (updates.ticket_type) {
    const validTypes = ['epic', 'story', 'task', 'bug', 'spike'];
    if (!validTypes.includes(updates.ticket_type as string)) {
      return NextResponse.json(
        { data: null, error: `ticket_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
  }

  // Role-based assignment enforcement
  if (updates.assignee_agent_key_id) {
    // Workers can only self-assign, not reassign to others
    if (agentMembership.roleLevel === 'worker' && updates.assignee_agent_key_id !== auth.agentKeyId) {
      return NextResponse.json(
        { data: null, error: 'Workers can only assign tickets to themselves, not to other agents.' },
        { status: 403 }
      );
    }

    // Capability overlap check: ticket labels vs assignee's position capabilities
    const ticketLabels = ticket.labels as string[] | null;
    if (ticketLabels?.length) {
      const targetId = updates.assignee_agent_key_id as string;
      const targetMembership = await getAgentMembership(targetId, ticket.project_id);
      if (targetMembership && targetMembership.capabilities.length > 0) {
        const overlap = ticketLabels.some(l => targetMembership.capabilities.includes(l));
        if (!overlap) {
          return NextResponse.json(
            { data: null, error: `Cannot assign: agent's capabilities [${targetMembership.capabilities.join(', ')}] don't match ticket labels [${ticketLabels.join(', ')}].` },
            { status: 400 }
          );
        }
      }
    }
  }

  const { data: updated, error: updateError } = await admin
    .from('tickets')
    .update(updates)
    .eq('id', ticketId)
    .select(`
      id, project_id, ticket_number, title, description, status, priority,
      ticket_type, acceptance_criteria, parent_ticket_id, branch, deliverables,
      story_points, assignee_agent_key_id, assignee_user_id,
      created_by_user_id, created_by_agent_key_id, labels, due_date,
      created_at, updated_at
    `)
    .single();

  if (updateError) {
    return NextResponse.json(
      { data: null, error: 'Failed to update ticket' },
      { status: 500 }
    );
  }

  // Fire ticket_status_changed webhook if status changed
  if (updates.status && updates.status !== ticket.status) {
    const { data: members } = await admin
      .from('project_members')
      .select('agent_key_id')
      .eq('project_id', ticket.project_id)
      .not('agent_key_id', 'is', null);

    if (members?.length) {
      fireWebhooks(
        admin,
        'ticket_status_changed',
        members.map(m => m.agent_key_id!),
        {
          ticket_id: ticketId,
          ticket_number: ticket.ticket_number,
          title: ticket.title,
          old_status: ticket.status,
          new_status: updates.status,
          project_id: ticket.project_id,
        }
      );
    }
  }

  // Email project owner when ticket moves to done or in_review
  if (updates.status && ['done', 'in_review'].includes(updates.status as string) && updates.status !== ticket.status) {
    const { data: project } = await admin
      .from('projects')
      .select('owner_id, title')
      .eq('id', ticket.project_id)
      .single();

    if (project?.owner_id && ticket.assignee_agent_key_id) {
      const { data: agentKey } = await admin
        .from('agent_keys')
        .select('name')
        .eq('id', ticket.assignee_agent_key_id)
        .single();

      notifyTicketCompleted(
        project.owner_id,
        ticket.title,
        ticket.ticket_number,
        agentKey?.name || 'Unknown agent',
        project.title,
        ticket.project_id,
      ).catch(() => {});
    }
  }

  // Fire ticket_assigned webhook on reassignment
  if (updates.assignee_agent_key_id && updates.assignee_agent_key_id !== ticket.assignee_agent_key_id) {
    fireWebhooks(admin, 'ticket_assigned', [updates.assignee_agent_key_id as string], {
      ticket_id: ticketId,
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      project_id: ticket.project_id,
    });
  }

  return NextResponse.json({ data: updated });
}
