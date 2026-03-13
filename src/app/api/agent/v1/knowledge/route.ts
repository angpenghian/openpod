import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, verifyProjectMembership } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/agent/v1/knowledge?project_id=xxx&search=query&category=architecture
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const search = searchParams.get('search');
  const category = searchParams.get('category');
  const importance = searchParams.get('importance');

  if (!projectId) {
    return NextResponse.json(
      { data: null, error: 'project_id is required' },
      { status: 400 }
    );
  }

  // Validate category enum if provided
  const validCategories = ['architecture', 'decisions', 'patterns', 'context', 'general'];
  if (category && !validCategories.includes(category)) {
    return NextResponse.json(
      { data: null, error: `category must be one of: ${validCategories.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate importance enum if provided
  const validImportance = ['pinned', 'high', 'normal', 'low'];
  if (importance && !validImportance.includes(importance)) {
    return NextResponse.json(
      { data: null, error: `importance must be one of: ${validImportance.join(', ')}` },
      { status: 400 }
    );
  }

  // Verify membership
  const membership = await verifyProjectMembership(auth.agentKeyId, projectId);
  if (!membership) {
    return NextResponse.json(
      { data: null, error: 'Not a member of this project' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // If search query is provided, use full-text search via RPC or raw filter
  if (search?.trim()) {
    const { data: entries, error } = await admin
      .rpc('search_knowledge', {
        p_project_id: projectId,
        p_query: search.trim(),
        p_category: category || null,
      });

    // If RPC doesn't exist, fall back to textSearch filter
    if (error) {
      // Fallback: use Supabase textSearch filter on search_vector
      let fallbackQuery = admin
        .from('knowledge_entries')
        .select('id, project_id, title, content, category, tags, importance, version, created_by_agent_key_id, created_by_user_id, created_at, updated_at')
        .eq('project_id', projectId)
        .textSearch('search_vector', search.trim(), { type: 'plain', config: 'english' })
        .order('updated_at', { ascending: false })
        .limit(50);

      if (category) {
        fallbackQuery = fallbackQuery.eq('category', category);
      }
      if (importance) {
        fallbackQuery = fallbackQuery.eq('importance', importance);
      }

      const { data: fallbackEntries, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        return NextResponse.json(
          { data: null, error: 'Failed to search knowledge entries' },
          { status: 500 }
        );
      }

      return NextResponse.json({ data: fallbackEntries || [] });
    }

    return NextResponse.json({ data: entries || [] });
  }

  // No search — list with optional filters
  let query = admin
    .from('knowledge_entries')
    .select('id, project_id, title, content, category, tags, importance, version, created_by_agent_key_id, created_by_user_id, created_at, updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (category) {
    query = query.eq('category', category);
  }
  if (importance) {
    query = query.eq('importance', importance);
  }

  const { data: entries, error } = await query;

  if (error) {
    return NextResponse.json(
      { data: null, error: 'Failed to fetch knowledge entries' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: entries || [] });
}

// POST /api/agent/v1/knowledge — Create knowledge entry
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  let body: {
    project_id?: string;
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    importance?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { project_id, title, content, category, tags, importance } = body;

  if (!project_id || !title?.trim() || !content?.trim()) {
    return NextResponse.json(
      { data: null, error: 'project_id, title, and content are required' },
      { status: 400 }
    );
  }

  if (title.trim().length < 5) {
    return NextResponse.json(
      { data: null, error: 'Title must be at least 5 characters. Use a descriptive title that tells other agents what this entry covers.' },
      { status: 400 }
    );
  }

  if (content.trim().length < 50) {
    return NextResponse.json(
      { data: null, error: 'Content must be at least 50 characters. Knowledge entries should be detailed enough for other agents to understand the context. Use markdown headers (##) to structure: Context, Decision/Pattern, Details, Trade-offs.' },
      { status: 400 }
    );
  }

  // Validate category
  const validCategories = ['architecture', 'decisions', 'patterns', 'context', 'general'];
  const resolvedCategory = category || 'general';
  if (!validCategories.includes(resolvedCategory)) {
    return NextResponse.json(
      { data: null, error: `category must be one of: ${validCategories.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate importance
  const validImportance = ['pinned', 'high', 'normal', 'low'];
  const resolvedImportance = importance || 'normal';
  if (!validImportance.includes(resolvedImportance)) {
    return NextResponse.json(
      { data: null, error: `importance must be one of: ${validImportance.join(', ')}` },
      { status: 400 }
    );
  }

  // Verify membership
  const membership = await verifyProjectMembership(auth.agentKeyId, project_id);
  if (!membership) {
    return NextResponse.json(
      { data: null, error: 'Not a member of this project' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  const { data: entry, error } = await admin
    .from('knowledge_entries')
    .insert({
      project_id,
      title: title.trim().slice(0, 500),
      content: content.trim().slice(0, 50000),
      category: resolvedCategory,
      tags: tags || [],
      importance: resolvedImportance,
      version: 1,
      created_by_agent_key_id: auth.agentKeyId,
    })
    .select('id, project_id, title, content, category, tags, importance, version, created_by_agent_key_id, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json(
      { data: null, error: 'Failed to create knowledge entry' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: entry }, { status: 201 });
}
