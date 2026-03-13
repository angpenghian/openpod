import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, verifyProjectMembership, getAgentMembership } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fireWebhooks } from '@/lib/webhooks';

// GET /api/agent/v1/tickets?project_id=xxx&status=todo&assignee=me
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const status = searchParams.get('status');
  const assignee = searchParams.get('assignee');

  if (!projectId) {
    return NextResponse.json(
      { data: null, error: 'project_id is required' },
      { status: 400 }
    );
  }

  // Verify membership
  const membership = await verifyProjectMembership(auth.agentKeyId, projectId);
  if (!membership) {
    return NextResponse.json(
      { data: null, error: 'Not a member of this project' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  let query = admin
    .from('tickets')
    .select(`
      id, project_id, ticket_number, title, description, status, priority,
      ticket_type, acceptance_criteria, parent_ticket_id, branch, deliverables,
      story_points, assignee_agent_key_id, assignee_user_id,
      created_by_user_id, created_by_agent_key_id, labels, due_date,
      created_at, updated_at
    `)
    .eq('project_id', projectId)
    .order('ticket_number', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  if (assignee === 'me') {
    query = query.eq('assignee_agent_key_id', auth.agentKeyId);
  }

  const { data: tickets, error } = await query.limit(100);

  if (error) {
    return NextResponse.json(
      { data: null, error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: tickets || [] });
}

// POST /api/agent/v1/tickets — Create a ticket
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  let body: {
    project_id?: string;
    title?: string;
    description?: string;
    priority?: string;
    ticket_type?: string;
    acceptance_criteria?: string[];
    labels?: string[];
    assignee_agent_key_id?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { project_id, title, description, priority, ticket_type, acceptance_criteria, labels, assignee_agent_key_id } = body;

  if (!project_id || !title?.trim()) {
    return NextResponse.json(
      { data: null, error: 'project_id and title are required' },
      { status: 400 }
    );
  }

  // Validate enums
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (priority && !validPriorities.includes(priority)) {
    return NextResponse.json(
      { data: null, error: `priority must be one of: ${validPriorities.join(', ')}` },
      { status: 400 }
    );
  }

  const validTypes = ['epic', 'story', 'task', 'bug', 'spike'];
  if (ticket_type && !validTypes.includes(ticket_type)) {
    return NextResponse.json(
      { data: null, error: `ticket_type must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    );
  }

  // Enforce description quality for actionable ticket types
  const resolvedType = ticket_type || 'task';
  if (['story', 'task', 'bug'].includes(resolvedType)) {
    if (!description?.trim() || description.trim().length < 30) {
      return NextResponse.json(
        { data: null, error: `${resolvedType} tickets require a detailed description (at least 30 characters). Include context, approach, and deliverables so another agent can work on this without asking questions.` },
        { status: 400 }
      );
    }
  }

  if (resolvedType === 'story' && (!acceptance_criteria || !Array.isArray(acceptance_criteria) || acceptance_criteria.length === 0)) {
    return NextResponse.json(
      { data: null, error: 'Story tickets require at least one acceptance criterion. Each criterion should be a testable pass/fail condition (e.g. "User can log in with email and password").' },
      { status: 400 }
    );
  }

  // Verify membership + role
  const agentMembership = await getAgentMembership(auth.agentKeyId, project_id);
  if (!agentMembership) {
    return NextResponse.json(
      { data: null, error: 'Not a member of this project' },
      { status: 403 }
    );
  }

  // Only PMs and leads can create tickets
  if (agentMembership.roleLevel === 'worker') {
    return NextResponse.json(
      { data: null, error: 'Workers cannot create tickets. Only PMs and leads can create tickets.' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // Validate assignee capability overlap if both labels and assignee are provided
  if (assignee_agent_key_id && labels?.length) {
    const assigneeMembership = await getAgentMembership(assignee_agent_key_id, project_id);
    if (assigneeMembership && assigneeMembership.capabilities.length > 0) {
      const overlap = labels.some(l => assigneeMembership.capabilities.includes(l));
      if (!overlap) {
        return NextResponse.json(
          { data: null, error: `Assignee's capabilities [${assigneeMembership.capabilities.join(', ')}] don't match ticket labels [${labels.join(', ')}]. Assign to an agent with matching skills.` },
          { status: 400 }
        );
      }
    }
  }

  // Get next ticket number (auto-increment)
  const { data: lastTicket } = await admin
    .from('tickets')
    .select('ticket_number')
    .eq('project_id', project_id)
    .order('ticket_number', { ascending: false })
    .limit(1)
    .single();

  const nextNumber = (lastTicket?.ticket_number || 0) + 1;

  const { data: ticket, error } = await admin
    .from('tickets')
    .insert({
      project_id,
      ticket_number: nextNumber,
      title: title.trim().slice(0, 500),
      description: description?.trim().slice(0, 10000) || null,
      status: 'todo',
      priority: priority || 'medium',
      ticket_type: ticket_type || 'task',
      acceptance_criteria: acceptance_criteria || null,
      labels: labels || [],
      assignee_agent_key_id: assignee_agent_key_id || null,
      created_by_agent_key_id: auth.agentKeyId,
    })
    .select(`
      id, project_id, ticket_number, title, description, status, priority,
      ticket_type, acceptance_criteria, labels, assignee_agent_key_id,
      created_by_agent_key_id, created_at, updated_at
    `)
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: 'Failed to create ticket' },
      { status: 500 }
    );
  }

  // Fire ticket_assigned webhook if assigned
  if (ticket && assignee_agent_key_id) {
    fireWebhooks(admin, 'ticket_assigned', [assignee_agent_key_id], {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      project_id,
      priority: ticket.priority,
    });
  }

  return NextResponse.json({ data: ticket }, { status: 201 });
}
