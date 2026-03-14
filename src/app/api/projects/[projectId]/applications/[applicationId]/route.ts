import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkCsrfOrigin } from '@/lib/csrf';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/projects/[projectId]/applications/[applicationId]
// Server-side accept/reject for applications (fixes C5: client-side auth bypass)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; applicationId: string }> }
) {
  const csrfError = checkCsrfOrigin(request);
  if (csrfError) return csrfError;

  const { projectId, applicationId } = await params;

  if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(applicationId)) {
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

  const { action } = body as { action?: string };
  if (!action || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user owns the project
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Only the project owner can manage applications' }, { status: 403 });
  }

  // C5: applications table has no project_id column — verify via position join
  const { data: application } = await admin
    .from('applications')
    .select('id, status, agent_key_id, position_id, positions!inner(project_id)')
    .eq('id', applicationId)
    .single();

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // Verify the application belongs to this project (via position → project_id)
  const appProjectId = (application.positions as unknown as { project_id: string })?.project_id;
  if (appProjectId !== projectId) {
    return NextResponse.json({ error: 'Application not found in this project' }, { status: 404 });
  }

  if (application.status !== 'pending') {
    return NextResponse.json({ error: `Application is already ${application.status}` }, { status: 400 });
  }

  if (action === 'reject') {
    await admin
      .from('applications')
      .update({ status: 'rejected' })
      .eq('id', applicationId);

    return NextResponse.json({ data: { application_id: applicationId, action: 'rejected' } });
  }

  // action === 'accept'
  // H2: Check position is still open and respect max_agents
  const { data: position } = await admin
    .from('positions')
    .select('id, role_level, max_agents, status')
    .eq('id', application.position_id)
    .single();

  if (!position || position.status !== 'open') {
    return NextResponse.json({ error: 'Position is already filled' }, { status: 409 });
  }

  const { count: currentMembers } = await admin
    .from('project_members')
    .select('id', { count: 'exact', head: true })
    .eq('position_id', application.position_id);

  const maxAgents = position.max_agents || 1;
  if ((currentMembers || 0) >= maxAgents) {
    return NextResponse.json({ error: 'Position is at capacity' }, { status: 409 });
  }

  // 1. Update application status
  await admin
    .from('applications')
    .update({ status: 'accepted' })
    .eq('id', applicationId);

  // 2. Create project member
  await admin.from('project_members').insert({
    project_id: projectId,
    agent_key_id: application.agent_key_id,
    position_id: application.position_id,
    role: position.role_level === 'project_manager' ? 'pm' : 'agent',
  });

  // 3. Only fill position and reject others when last slot is taken
  if ((currentMembers || 0) + 1 >= maxAgents) {
    await admin
      .from('positions')
      .update({ status: 'filled' })
      .eq('id', application.position_id)
      .eq('status', 'open');

    await admin
      .from('applications')
      .update({ status: 'rejected' })
      .eq('position_id', application.position_id)
      .eq('status', 'pending')
      .neq('id', applicationId);
  }

  return NextResponse.json({
    data: { application_id: applicationId, action: 'accepted' },
  });
}
