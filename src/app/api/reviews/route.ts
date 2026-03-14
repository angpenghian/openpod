import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkCsrfOrigin } from '@/lib/csrf';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/reviews
 *
 * Submit a review for an agent on a completed ticket.
 * Auth: cookie-based (project owner only).
 * Body: { project_id, agent_registry_id, ticket_id, rating, comment? }
 */
export async function POST(request: NextRequest) {
  const csrfError = checkCsrfOrigin(request);
  if (csrfError) return csrfError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: {
    project_id?: string;
    agent_registry_id?: string;
    ticket_id?: string;
    rating?: number;
    comment?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { project_id, agent_registry_id, ticket_id, rating, comment } = body;

  // Validate required fields
  if (!project_id || !agent_registry_id || !ticket_id || !rating) {
    return NextResponse.json(
      { error: 'project_id, agent_registry_id, ticket_id, and rating are required' },
      { status: 400 }
    );
  }

  // Validate UUIDs
  if (!UUID_REGEX.test(project_id) || !UUID_REGEX.test(agent_registry_id) || !UUID_REGEX.test(ticket_id)) {
    return NextResponse.json({ error: 'Invalid UUID format' }, { status: 400 });
  }

  // Validate rating
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user is the project owner
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id')
    .eq('id', project_id)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Only the project owner can leave reviews' }, { status: 403 });
  }

  // Verify ticket exists, is done, and has the agent assigned
  const { data: ticket } = await admin
    .from('tickets')
    .select('id, status, assignee_agent_key_id')
    .eq('id', ticket_id)
    .eq('project_id', project_id)
    .single();

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found in this project' }, { status: 404 });
  }
  if (ticket.status !== 'done') {
    return NextResponse.json({ error: 'Can only review completed tickets' }, { status: 400 });
  }
  if (!ticket.assignee_agent_key_id) {
    return NextResponse.json({ error: 'Ticket has no assigned agent' }, { status: 400 });
  }

  // Verify the agent_registry_id matches the assigned agent's registry
  const { data: agentKey } = await admin
    .from('agent_keys')
    .select('registry_id')
    .eq('id', ticket.assignee_agent_key_id)
    .single();

  if (!agentKey?.registry_id || agentKey.registry_id !== agent_registry_id) {
    return NextResponse.json({ error: 'Agent does not match the ticket assignee' }, { status: 400 });
  }

  // Check for duplicate review (same reviewer, same ticket agent combo)
  const { data: existing } = await admin
    .from('reviews')
    .select('id')
    .eq('project_id', project_id)
    .eq('reviewer_id', user.id)
    .eq('agent_registry_id', agent_registry_id)
    .eq('ticket_id', ticket_id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'You have already reviewed this agent on this project' }, { status: 409 });
  }

  // Insert review (trigger auto-updates rating_avg/rating_count on agent_registry)
  const { data: review, error: insertError } = await admin
    .from('reviews')
    .insert({
      project_id,
      reviewer_id: user.id,
      agent_registry_id,
      rating,
      comment: comment?.trim().slice(0, 2000) || null,
    })
    .select('id, rating, comment, created_at')
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }

  return NextResponse.json({ data: review }, { status: 201 });
}
