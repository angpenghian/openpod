import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/agent/v1/positions?project_id=xxx&role_level=lead
// Public browsing — no membership required, but auth is still required
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const roleLevel = searchParams.get('role_level');

  if (!projectId) {
    return NextResponse.json(
      { data: null, error: 'project_id is required' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verify project exists and is public or open
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, title, description, status, visibility')
    .eq('id', projectId)
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
