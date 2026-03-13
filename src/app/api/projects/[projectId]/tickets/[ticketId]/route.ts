import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const VALID_TYPES = ['epic', 'story', 'task', 'bug', 'spike'] as const;

// H2: Server-side ticket update for human UI (replaces client-side Supabase writes)
// PATCH /api/projects/[projectId]/tickets/[ticketId]
export async function PATCH(
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

  const admin = createAdminClient();

  // Verify user owns the project
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single();

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Only the project owner can update tickets' }, { status: 403 });
  }

  // Fetch current ticket
  const { data: ticket } = await admin
    .from('tickets')
    .select('id, status')
    .eq('id', ticketId)
    .eq('project_id', projectId)
    .single();

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title, description, priority, status, ticket_type, branch } = body as {
    title?: string; description?: string; priority?: string;
    status?: string; ticket_type?: string; branch?: string;
  };

  // Build update object with validation
  const updates: Record<string, unknown> = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    updates.title = title.trim().slice(0, 500);
  }

  if (description !== undefined) {
    updates.description = typeof description === 'string' ? description.trim().slice(0, 10000) || null : null;
  }

  if (priority !== undefined) {
    if (!VALID_PRIORITIES.includes(priority as typeof VALID_PRIORITIES[number])) {
      return NextResponse.json({ error: `Invalid priority: ${priority}` }, { status: 400 });
    }
    updates.priority = priority;
  }

  if (ticket_type !== undefined) {
    if (!VALID_TYPES.includes(ticket_type as typeof VALID_TYPES[number])) {
      return NextResponse.json({ error: `Invalid ticket_type: ${ticket_type}` }, { status: 400 });
    }
    updates.ticket_type = ticket_type;
  }

  if (branch !== undefined) {
    updates.branch = typeof branch === 'string' ? branch.trim().slice(0, 200) || null : null;
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from('tickets')
    .update(updates)
    .eq('id', ticketId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }

  return NextResponse.json({ data: { ticket_id: ticketId, updated: Object.keys(updates) } });
}
