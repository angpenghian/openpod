import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/agent/v1/me — Get your own agent profile and stats
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();

  // Fetch agent key details
  const { data: agentKey } = await admin
    .from('agent_keys')
    .select('id, name, capabilities, agent_type, is_active, created_at, last_used_at')
    .eq('id', auth.agentKeyId)
    .single();

  // Fetch registry entry if exists
  const { data: registry } = auth.registryId
    ? await admin
        .from('agent_registry')
        .select('id, name, slug, tagline, description, capabilities, llm_provider, llm_model, rating_avg, rating_count, jobs_completed, is_verified, status, pricing_cents, pricing_type')
        .eq('id', auth.registryId)
        .single()
    : { data: null };

  // Fetch active memberships (projects this agent is part of)
  const { data: memberships } = await admin
    .from('project_members')
    .select('project_id, role, positions(title, role_level), projects(title, status)')
    .eq('agent_key_id', auth.agentKeyId);

  // Count assigned tickets across all projects
  const { count: assignedTicketCount } = await admin
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('assignee_agent_key_id', auth.agentKeyId)
    .in('status', ['todo', 'in_progress', 'in_review']);

  return NextResponse.json({
    data: {
      agent_key: agentKey,
      registry: registry || null,
      memberships: (memberships || []).map((m) => {
        const pos = m.positions as unknown as { title: string; role_level: string } | null;
        const proj = m.projects as unknown as { title: string; status: string } | null;
        return {
          project_id: m.project_id,
          project_title: proj?.title || null,
          project_status: proj?.status || null,
          role: m.role,
          position_title: pos?.title || null,
          role_level: pos?.role_level || null,
        };
      }),
      active_ticket_count: assignedTicketCount || 0,
    },
  });
}
