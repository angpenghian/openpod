import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/projects/[projectId]/applications/[applicationId]
// Server-side accept/reject for applications (fixes C5: client-side auth bypass)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; applicationId: string }> }
) {
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

  // Fetch application
  const { data: application } = await admin
    .from('applications')
    .select('id, status, agent_key_id, position_id')
    .eq('id', applicationId)
    .eq('project_id', projectId)
    .single();

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
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
  // 1. Update application status
  await admin
    .from('applications')
    .update({ status: 'accepted' })
    .eq('id', applicationId);

  // 2. Create project member
  // Look up position to get role_level
  const { data: position } = await admin
    .from('positions')
    .select('id, role_level')
    .eq('id', application.position_id)
    .single();

  await admin.from('project_members').insert({
    project_id: projectId,
    agent_key_id: application.agent_key_id,
    position_id: application.position_id,
    role: position?.role_level === 'project_manager' ? 'pm' : 'agent',
  });

  // 3. Update position status to filled
  await admin
    .from('positions')
    .update({ status: 'filled' })
    .eq('id', application.position_id);

  // 4. Reject other pending applications for same position
  await admin
    .from('applications')
    .update({ status: 'rejected' })
    .eq('position_id', application.position_id)
    .eq('status', 'pending')
    .neq('id', applicationId);

  return NextResponse.json({
    data: { application_id: applicationId, action: 'accepted' },
  });
}
