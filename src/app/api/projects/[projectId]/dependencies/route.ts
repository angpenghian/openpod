import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkCsrfOrigin } from '@/lib/csrf';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/projects/[projectId]/dependencies
 * List all dependencies for tickets in this project.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  if (!UUID_REGEX.test(projectId)) {
    return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();

  // Verify user is project owner or member
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { data: tickets } = await admin
    .from('tickets')
    .select('id')
    .eq('project_id', projectId);
  const ticketIds = (tickets || []).map(t => t.id);
  if (ticketIds.length === 0) return NextResponse.json({ data: [] });

  const { data: deps } = await admin
    .from('ticket_dependencies')
    .select('id, ticket_id, depends_on, created_at')
    .in('ticket_id', ticketIds)
    .order('created_at', { ascending: true });

  return NextResponse.json({ data: deps || [] });
}

/**
 * POST /api/projects/[projectId]/dependencies
 * Create a dependency: ticket_id depends_on another ticket.
 * Body: { ticket_id, depends_on }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const csrfError = checkCsrfOrigin(request);
  if (csrfError) return csrfError;

  const { projectId } = await params;
  if (!UUID_REGEX.test(projectId)) {
    return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { ticket_id?: string; depends_on?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { ticket_id, depends_on } = body;
  if (!ticket_id || !depends_on) {
    return NextResponse.json({ error: 'ticket_id and depends_on are required' }, { status: 400 });
  }
  if (!UUID_REGEX.test(ticket_id) || !UUID_REGEX.test(depends_on)) {
    return NextResponse.json({ error: 'Invalid UUID format' }, { status: 400 });
  }
  if (ticket_id === depends_on) {
    return NextResponse.json({ error: 'A ticket cannot depend on itself' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user is project owner
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single();

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Verify both tickets belong to this project
  const { data: tickets } = await admin
    .from('tickets')
    .select('id')
    .eq('project_id', projectId)
    .in('id', [ticket_id, depends_on]);

  if (!tickets || tickets.length !== 2) {
    return NextResponse.json({ error: 'Both tickets must belong to this project' }, { status: 400 });
  }

  // Fetch all project ticket IDs for cycle check
  const { data: allTickets } = await admin
    .from('tickets')
    .select('id')
    .eq('project_id', projectId);
  const allTicketIds = (allTickets || []).map(t => t.id);

  // Circular dependency check (in-memory BFS to avoid N+1 queries)
  const { data: allDeps } = await admin
    .from('ticket_dependencies')
    .select('ticket_id, depends_on')
    .in('ticket_id', allTicketIds);

  const depMap = new Map<string, string[]>();
  for (const d of allDeps || []) {
    const existing = depMap.get(d.ticket_id) || [];
    existing.push(d.depends_on);
    depMap.set(d.ticket_id, existing);
  }

  function hasCycle(start: string): boolean {
    const visited = new Set<string>();
    const queue = [...(depMap.get(start) || [])];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (current === ticket_id) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of depMap.get(current) || []) {
        queue.push(next);
      }
    }
    return false;
  }

  if (hasCycle(depends_on)) {
    return NextResponse.json({ error: 'Would create a circular dependency' }, { status: 400 });
  }

  const { data: dep, error: insertError } = await admin
    .from('ticket_dependencies')
    .insert({ ticket_id, depends_on })
    .select('id, ticket_id, depends_on, created_at')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create dependency' }, { status: 500 });
  }

  return NextResponse.json({ data: dep }, { status: 201 });
}

/**
 * DELETE /api/projects/[projectId]/dependencies
 * Remove a dependency.
 * Body: { dependency_id }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const csrfError = checkCsrfOrigin(request);
  if (csrfError) return csrfError;

  const { projectId } = await params;
  if (!UUID_REGEX.test(projectId)) {
    return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { dependency_id?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.dependency_id || !UUID_REGEX.test(body.dependency_id)) {
    return NextResponse.json({ error: 'Valid dependency_id is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user is project owner
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single();

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Verify the dependency belongs to a ticket in this project
  const { data: dep } = await admin
    .from('ticket_dependencies')
    .select('id, ticket_id')
    .eq('id', body.dependency_id)
    .single();

  if (!dep) {
    return NextResponse.json({ error: 'Dependency not found' }, { status: 404 });
  }

  const { data: ticket } = await admin
    .from('tickets')
    .select('id')
    .eq('id', dep.ticket_id)
    .eq('project_id', projectId)
    .single();

  if (!ticket) {
    return NextResponse.json({ error: 'Dependency does not belong to this project' }, { status: 403 });
  }

  const { error: deleteError } = await admin
    .from('ticket_dependencies')
    .delete()
    .eq('id', body.dependency_id);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete dependency' }, { status: 500 });
  }

  return NextResponse.json({ data: { deleted: true } });
}
