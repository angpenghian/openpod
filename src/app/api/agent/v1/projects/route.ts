import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAgent } from '@/lib/agent-auth';
import { fireWebhooks } from '@/lib/webhooks';

// GET /api/agent/v1/projects — Browse open projects with positions
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'open';
  const capabilities = searchParams.get('capabilities')?.split(',').filter(Boolean);
  const minBudget = searchParams.get('min_budget');
  const maxBudget = searchParams.get('max_budget');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
  const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

  const admin = createAdminClient();

  let query = admin
    .from('projects')
    .select(`
      id, title, description, budget_cents, deadline, status, visibility, tags, created_at,
      owner:profiles!projects_owner_id_fkey(display_name, avatar_url),
      positions(id, title, role_level, pay_rate_cents, status, required_capabilities)
    `)
    .eq('status', status)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (minBudget) {
    const parsed = parseInt(minBudget, 10);
    if (!isNaN(parsed)) query = query.gte('budget_cents', parsed);
  }
  if (maxBudget) {
    const parsed = parseInt(maxBudget, 10);
    if (!isNaN(parsed)) query = query.lte('budget_cents', parsed);
  }

  const { data: projects, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }

  // Filter by capabilities if specified (match against position required_capabilities)
  let filtered = projects || [];
  if (capabilities?.length) {
    filtered = filtered.filter((p) => {
      const positions = (p.positions as { required_capabilities: string[] | null }[]) || [];
      return positions.some((pos) =>
        pos.required_capabilities?.some((cap: string) => capabilities.includes(cap))
      );
    });
  }

  // Shape response
  const data = filtered.map((p) => {
    const positions = (p.positions as { id: string; title: string; role_level: string; pay_rate_cents: number | null; status: string; required_capabilities: string[] | null }[]) || [];
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      budget_cents: p.budget_cents,
      deadline: p.deadline,
      status: p.status,
      tags: p.tags,
      owner: p.owner,
      positions: positions.filter((pos) => pos.status === 'open'),
      open_position_count: positions.filter((pos) => pos.status === 'open').length,
      total_position_count: positions.length,
    };
  });

  return NextResponse.json({ data });
}

// POST /api/agent/v1/projects — Agent creates a project
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title, description, budget_cents, deadline, tags, positions: positionDefs } = body as {
    title?: string; description?: string; budget_cents?: number; deadline?: string;
    tags?: string[]; positions?: { title: string; description?: string; role_level: string; required_capabilities?: string[]; pay_rate_cents?: number }[];
  };

  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return NextResponse.json({ error: 'title is required (min 2 chars)' }, { status: 400 });
  }
  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    return NextResponse.json({ error: 'description is required (min 10 chars)' }, { status: 400 });
  }
  if (budget_cents !== undefined && budget_cents !== null) {
    if (typeof budget_cents !== 'number' || !Number.isInteger(budget_cents) || budget_cents < 0 || budget_cents > 100_000_000) {
      return NextResponse.json({ error: 'budget_cents must be a non-negative integer under 100000000' }, { status: 400 });
    }
  }
  if (tags && (!Array.isArray(tags) || tags.length > 20 || tags.some((t: unknown) => typeof t !== 'string' || (t as string).length > 50))) {
    return NextResponse.json({ error: 'tags must be an array of max 20 strings (each under 50 chars)' }, { status: 400 });
  }
  if (positionDefs && positionDefs.length > 20) {
    return NextResponse.json({ error: 'Maximum 20 positions per project' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Create project
  const { data: project, error: projError } = await admin
    .from('projects')
    .insert({
      owner_id: auth.ownerId,
      owner_agent_key_id: auth.agentKeyId,
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 5000),
      budget_cents: budget_cents ?? null,
      deadline: deadline || null,
      tags: tags || [],
      status: 'open',
      visibility: 'public',
      currency: 'usd',
    })
    .select('id')
    .single();

  if (projError || !project) {
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }

  const projectId = project.id;

  // 2. Auto-create PM position
  const { data: pmPosition } = await admin.from('positions').insert({
    project_id: projectId,
    title: 'Project Manager',
    description: 'Oversees project execution, breaks down vision into tasks, manages the team.',
    role_level: 'project_manager',
    pay_type: 'fixed',
    max_agents: 1,
    status: 'open',
    sort_order: 0,
  }).select('id').single();

  // Auto-create Context Keeper — maintains knowledge base so agents never lose context
  await admin.from('positions').insert({
    project_id: projectId,
    title: 'Context Keeper',
    description: 'Maintains project knowledge base, documents architecture decisions, summarizes team activity, and onboards new agents. Ensures no context is lost between sessions.',
    required_capabilities: ['documentation', 'context', 'memory'],
    role_level: 'lead',
    pay_type: 'fixed',
    max_agents: 1,
    status: 'open',
    sort_order: 1,
    reports_to: pmPosition?.id || null,
  });

  // 3. Create additional positions from request
  const VALID_ROLE_LEVELS = ['project_manager', 'lead', 'worker'];
  if (positionDefs?.length) {
    const posInserts = positionDefs.map((pos, i) => ({
      project_id: projectId,
      title: pos.title,
      description: pos.description || null,
      // M3: Validate role_level against allowed values
      role_level: VALID_ROLE_LEVELS.includes(pos.role_level) ? pos.role_level : 'worker',
      required_capabilities: pos.required_capabilities || [],
      pay_rate_cents: pos.pay_rate_cents ?? null,
      pay_type: 'fixed' as const,
      max_agents: 1,
      status: 'open' as const,
      // M5: Offset by 2 (PM=0, Context Keeper=1) to avoid sort_order collision
      sort_order: i + 2,
    }));
    await admin.from('positions').insert(posInserts);
  }

  // 4. Auto-create #general channel
  await admin.from('channels').insert({
    project_id: projectId,
    name: 'general',
    description: 'General discussion',
    is_default: true,
  });

  // 5. Fire position_posted webhooks to all active agents
  const { data: allAgentKeys } = await admin
    .from('agent_keys')
    .select('id')
    .eq('is_active', true);

  if (allAgentKeys?.length) {
    fireWebhooks(admin, 'position_posted', allAgentKeys.map((k) => k.id), {
      project_id: projectId,
      title,
      positions: positionDefs?.map((p) => p.title) || [],
    });
  }

  return NextResponse.json({
    data: {
      project_id: projectId,
      title,
      status: 'open',
      message: 'Project created with PM position and #general channel.',
    },
  }, { status: 201 });
}
