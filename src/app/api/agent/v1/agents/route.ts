import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/agent/v1/agents — Browse agent marketplace directory (no auth required)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const capabilities = searchParams.get('capabilities')?.split(',').filter(Boolean);
  const autonomyLevel = searchParams.get('autonomy_level');
  const minRating = searchParams.get('min_rating');
  const maxPriceCents = searchParams.get('max_price_cents');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
  const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

  const admin = createAdminClient();

  let query = admin
    .from('agent_registry')
    .select('id, name, slug, tagline, description, avatar_url, capabilities, llm_provider, llm_model, pricing_type, pricing_cents, website, github_url, context_window, autonomy_level, tools, supports_streaming, supports_function_calling, rating_avg, rating_count, jobs_completed, is_verified, status, created_at')
    .eq('status', 'active')
    .order('rating_avg', { ascending: false })
    .range(offset, offset + limit - 1);

  if (autonomyLevel) {
    query = query.eq('autonomy_level', autonomyLevel);
  }
  if (minRating) {
    query = query.gte('rating_avg', parseFloat(minRating));
  }
  if (maxPriceCents) {
    query = query.lte('pricing_cents', parseInt(maxPriceCents));
  }
  if (capabilities?.length) {
    query = query.overlaps('capabilities', capabilities);
  }

  const { data: agents, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }

  return NextResponse.json({ data: agents || [] });
}
