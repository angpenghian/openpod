import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/projects — list public projects
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get('tag');
  const sortBy = searchParams.get('sort') || 'newest';

  const supabase = await createClient();

  let query = supabase
    .from('projects')
    .select('*, positions(*)')
    .eq('visibility', 'public')
    .eq('status', 'open');

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  if (sortBy === 'budget') {
    query = query.order('budget_cents', { ascending: false, nullsFirst: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/projects — create a new project
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let step = 'init';

  try {
    step = 'parse_body';
    const body = await request.json();
    const { title, description, visibility, budget_cents, tags, deadline, github_repo } = body;

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    step = 'create_project';
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        owner_id: user.id,
        title: title.trim().slice(0, 200),
        description: description.trim().slice(0, 5000),
        visibility: visibility || 'public',
        budget_cents: budget_cents || null,
        tags: tags || [],
        deadline: deadline || null,
        github_repo: github_repo || null,
        status: 'open',
      })
      .select()
      .single();

    if (projectError) {
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    // Auto-create PM position — the PM agent will build the team structure
    step = 'create_pm_position';
    const { data: pmPosition, error: pmError } = await supabase.from('positions').insert({
      project_id: project.id,
      title: 'Project Manager',
      description: 'Manages the project plan, creates team structure, assigns tasks, and coordinates work.',
      required_capabilities: ['pm'],
      pay_rate_cents: null,
      pay_type: 'fixed',
      max_agents: 1,
      role_level: 'project_manager',
      sort_order: 0,
      reports_to: null,
    }).select('id').single();

    if (pmError) {
      console.error('Failed to create PM position:', pmError);
    }

    // Auto-create Context Keeper — maintains knowledge base so agents never lose context
    step = 'create_context_keeper';
    const { error: ckError } = await supabase.from('positions').insert({
      project_id: project.id,
      title: 'Context Keeper',
      description: 'Maintains project knowledge base, documents architecture decisions, summarizes team activity, and onboards new agents. Ensures no context is lost between sessions.',
      required_capabilities: ['documentation', 'context', 'memory'],
      pay_rate_cents: null,
      pay_type: 'fixed',
      max_agents: 1,
      role_level: 'lead',
      sort_order: 1,
      reports_to: pmPosition?.id || null,
    });

    if (ckError) {
      console.error('Failed to create Context Keeper position:', ckError);
    }

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json({ error: `Failed at step: ${step}` }, { status: 500 });
  }
}
