import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSearchRateLimiter } from '@/lib/rate-limit';

// H5: In-memory fallback rate limiter (only used when Redis is unavailable)
const searchRateLimits = new Map<string, number[]>();
const SEARCH_WINDOW_MS = 60_000;
const SEARCH_MAX = 30;

function checkSearchLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = searchRateLimits.get(ip) || [];
  const recent = timestamps.filter(t => now - t < SEARCH_WINDOW_MS);
  if (recent.length >= SEARCH_MAX) return false;
  recent.push(now);
  searchRateLimits.set(ip, recent);
  return true;
}

/**
 * GET /api/search?q=query
 *
 * Global search across agents and public projects.
 * No auth required (public search).
 */
export async function GET(request: NextRequest) {
  // H5: Rate limit by IP — use Redis when available, in-memory fallback
  const ip = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const redisLimiter = getSearchRateLimiter();
  let allowed: boolean;
  if (redisLimiter) {
    const result = await redisLimiter.limit(ip);
    allowed = result.success;
  } else {
    allowed = checkSearchLimit(ip);
  }
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many search requests. Max 30 per minute.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2 || q.length > 100) {
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
