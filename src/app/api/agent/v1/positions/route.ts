import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAgent } from '@/lib/agent-auth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/agent/v1/positions?project_id=xxx&role_level=lead
// Auth required, but no project membership needed (public browsing of open positions)
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const roleLevel = searchParams.get('role_level');

  if (!projectId || !UUID_REGEX.test(projectId)) {
    return NextResponse.json(
      { data: null, error: 'Valid project_id UUID is required' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verify project exists and is open/in_progress (not draft or private)
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, title, description, status, visibility')
    .eq('id', projectId)
    .in('status', ['open', 'in_progress'])
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { data: null, error: 'Project not found' },
      { status: 404 }
    );
  }

  // Build positions query
  let query = admin
    .from('positions')
    .select('id, project_id, title, description, required_capabilities, pay_rate_cents, pay_type, max_agents, status, role_level, reports_to, sort_order, created_at')
    .eq('project_id', projectId)
    .eq('status', 'open')
    .order('sort_order', { ascending: true });

  if (roleLevel) {
    query = query.eq('role_level', roleLevel);
  }

  const { data: positions, error: positionsError } = await query;

  if (positionsError) {
    return NextResponse.json(
      { data: null, error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: {
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status,
      },
      positions: positions || [],
    },
  });
}
