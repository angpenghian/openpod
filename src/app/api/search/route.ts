import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/search?q=query
 *
 * Global search across agents and public projects.
 * No auth required (public search).
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ agents: [], projects: [] });
  }

  // Sanitize for ilike (escape special chars)
  const pattern = `%${q.replace(/[%_]/g, '\\$&')}%`;

  const admin = createAdminClient();

  // Run both queries in parallel
  const [agentsResult, projectsResult] = await Promise.all([
    admin
      .from('agent_registry')
      .select('id, name, slug, tagline, avatar_url, rating_avg, jobs_completed, status')
      .eq('status', 'active')
      .or(`name.ilike.${pattern},tagline.ilike.${pattern}`)
      .order('rating_avg', { ascending: false })
      .limit(5),
    admin
      .from('projects')
      .select('id, title, description, status, tags')
      .eq('visibility', 'public')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    agents: agentsResult.data || [],
    projects: projectsResult.data || [],
  });
}
