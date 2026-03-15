import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashApiKey } from '@/lib/agent-auth';
import { getRegistrationRateLimiter } from '@/lib/rate-limit';
import crypto from 'crypto';

// H3: In-memory fallback (only used when Redis is unavailable)
const registerRateLimits = new Map<string, number[]>();
const REGISTER_WINDOW_MS = 3600_000;
const REGISTER_MAX = 5;

function checkRegistrationLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = registerRateLimits.get(ip) || [];
  const recent = timestamps.filter(t => now - t < REGISTER_WINDOW_MS);
  if (recent.length >= REGISTER_MAX) return false;
  recent.push(now);
  registerRateLimits.set(ip, recent);
  return true;
}

// POST /api/agent/v1/register — Agent self-registration (no auth required)
export async function POST(request: NextRequest) {
  // H3: Rate limit by IP — use Redis when available, in-memory fallback
  const ip = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const redisLimiter = getRegistrationRateLimiter();
  let allowed: boolean;
  if (redisLimiter) {
    const result = await redisLimiter.limit(ip);
    allowed = result.success;
  } else {
    allowed = checkRegistrationLimit(ip);
  }
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many registrations. Max 5 per hour.' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    name, tagline, description, capabilities,
    llm_provider, llm_model, pricing_type, pricing_cents,
    website, context_window, autonomy_level, tools,
    supports_streaming, supports_function_calling,
    wallet_address,
    // v15 profile fields
    framework, version, languages, source_url, demo_url,
    hosted_on, max_concurrent, tokens_per_second,
    // existing perf fields
    latency_ms, token_cost_input, token_cost_output,
    max_output_tokens, uptime_pct, avg_error_rate,
    github_url,
  } = body as {
    name?: string; tagline?: string; description?: string; capabilities?: string[];
    llm_provider?: string; llm_model?: string; pricing_type?: string; pricing_cents?: number;
    website?: string; context_window?: number; autonomy_level?: string; tools?: string[];
    supports_streaming?: boolean; supports_function_calling?: boolean;
    wallet_address?: string;
    framework?: string; version?: string; languages?: string[]; source_url?: string;
    demo_url?: string; hosted_on?: string; max_concurrent?: number; tokens_per_second?: number;
    latency_ms?: number; token_cost_input?: number; token_cost_output?: number;
    max_output_tokens?: number; uptime_pct?: number; avg_error_rate?: number;
    github_url?: string;
  };

  // Validate wallet address if provided
  if (wallet_address && !/^0x[0-9a-fA-F]{40}$/.test(wallet_address)) {
    return NextResponse.json({ error: 'wallet_address must be a valid Ethereum address (0x + 40 hex chars)' }, { status: 400 });
  }

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return NextResponse.json({ error: 'name is required (2-100 chars)' }, { status: 400 });
  }
  if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
    return NextResponse.json({ error: 'capabilities is required (non-empty array)' }, { status: 400 });
  }
  // M5: Limit array/string sizes to prevent storage exhaustion
  if (capabilities.length > 20) {
    return NextResponse.json({ error: 'Maximum 20 capabilities allowed' }, { status: 400 });
  }
  if (capabilities.some((c: unknown) => typeof c !== 'string' || (c as string).length > 50)) {
    return NextResponse.json({ error: 'Each capability must be a string under 50 chars' }, { status: 400 });
  }
  if (tools && Array.isArray(tools) && tools.length > 20) {
    return NextResponse.json({ error: 'Maximum 20 tools allowed' }, { status: 400 });
  }
  if (description && typeof description === 'string' && description.length > 5000) {
    return NextResponse.json({ error: 'Description must be under 5000 chars' }, { status: 400 });
  }
  if (tagline && typeof tagline === 'string' && tagline.length > 200) {
    return NextResponse.json({ error: 'Tagline must be under 200 chars' }, { status: 400 });
  }
  if (!pricing_type || !['per_task', 'hourly', 'monthly'].includes(pricing_type)) {
    return NextResponse.json({ error: 'pricing_type must be per_task, hourly, or monthly' }, { status: 400 });
  }
  if (pricing_cents == null || typeof pricing_cents !== 'number' || pricing_cents < 0 || !Number.isInteger(pricing_cents)) {
    return NextResponse.json({ error: 'pricing_cents must be a non-negative integer' }, { status: 400 });
  }
  if (pricing_cents > 10_000_000) {
    return NextResponse.json({ error: 'pricing_cents cannot exceed 10000000 ($100K)' }, { status: 400 });
  }
  if (website && typeof website === 'string') {
    try {
      const u = new URL(website);
      if (!['https:', 'http:'].includes(u.protocol)) {
        return NextResponse.json({ error: 'website must be an HTTP(S) URL' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'website must be a valid URL' }, { status: 400 });
    }
  }
  if (autonomy_level && !['full', 'semi', 'supervised'].includes(autonomy_level)) {
    return NextResponse.json({ error: 'autonomy_level must be full, semi, or supervised' }, { status: 400 });
  }
  if (tools && Array.isArray(tools) && tools.some((t: unknown) => typeof t !== 'string' || (t as string).length > 100)) {
    return NextResponse.json({ error: 'Each tool must be a string under 100 chars' }, { status: 400 });
  }
  // v15 field validation
  if (framework && (typeof framework !== 'string' || framework.length > 100)) {
    return NextResponse.json({ error: 'framework must be a string under 100 chars' }, { status: 400 });
  }
  if (version && (typeof version !== 'string' || version.length > 50)) {
    return NextResponse.json({ error: 'version must be a string under 50 chars' }, { status: 400 });
  }
  if (languages && Array.isArray(languages)) {
    if (languages.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 languages allowed' }, { status: 400 });
    }
    if (languages.some((l: unknown) => typeof l !== 'string' || (l as string).length > 50)) {
      return NextResponse.json({ error: 'Each language must be a string under 50 chars' }, { status: 400 });
    }
  }
  if (source_url && typeof source_url === 'string') {
    try {
      const u = new URL(source_url);
      if (!['https:', 'http:'].includes(u.protocol)) {
        return NextResponse.json({ error: 'source_url must be an HTTP(S) URL' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'source_url must be a valid URL' }, { status: 400 });
    }
  }
  if (demo_url && typeof demo_url === 'string') {
    try {
      const u = new URL(demo_url);
      if (!['https:', 'http:'].includes(u.protocol)) {
        return NextResponse.json({ error: 'demo_url must be an HTTP(S) URL' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'demo_url must be a valid URL' }, { status: 400 });
    }
  }
  if (github_url && typeof github_url === 'string') {
    try {
      const u = new URL(github_url);
      if (!['https:', 'http:'].includes(u.protocol)) {
        return NextResponse.json({ error: 'github_url must be an HTTP(S) URL' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'github_url must be a valid URL' }, { status: 400 });
    }
  }
  if (hosted_on && (typeof hosted_on !== 'string' || hosted_on.length > 100)) {
    return NextResponse.json({ error: 'hosted_on must be a string under 100 chars' }, { status: 400 });
  }
  if (max_concurrent != null && (typeof max_concurrent !== 'number' || max_concurrent < 1 || max_concurrent > 10000)) {
    return NextResponse.json({ error: 'max_concurrent must be between 1 and 10000' }, { status: 400 });
  }
  if (tokens_per_second != null && (typeof tokens_per_second !== 'number' || tokens_per_second < 0 || tokens_per_second > 100000)) {
    return NextResponse.json({ error: 'tokens_per_second must be between 0 and 100000' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Generate slug from name
  let slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Check uniqueness
  const { data: existing } = await admin
    .from('agent_registry')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  }

  // Generate API key with unique prefix (first 16 chars are the lookup prefix)
  const apiKey = `openpod_${crypto.randomUUID().replace(/-/g, '')}`;
  const apiKeyPrefix = apiKey.slice(0, 16);
  const apiKeyHash = hashApiKey(apiKey);

  // System owner for self-registered agents — use env var or earliest profile as fallback
  let ownerId: string;
  const systemUserId = process.env.OPENPOD_SYSTEM_USER_ID;

  if (systemUserId) {
    ownerId = systemUserId;
  } else {
    const { data: systemUser } = await admin
      .from('profiles')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!systemUser) {
      return NextResponse.json({ error: 'No system user configured' }, { status: 500 });
    }
    ownerId = systemUser.id;
  }

  // 1. Create agent_registry entry (marketplace profile)
  const { data: registry, error: regError } = await admin
    .from('agent_registry')
    .insert({
      builder_id: ownerId,
      name: name.trim(),
      slug,
      tagline: tagline || null,
      description: description || null,
      capabilities,
      llm_provider: llm_provider || null,
      llm_model: llm_model || null,
      pricing_type: pricing_type as 'per_task' | 'hourly' | 'monthly',
      pricing_cents,
      website: website || null,
      github_url: github_url || null,
      context_window: context_window ?? null,
      latency_ms: latency_ms ?? null,
      token_cost_input: token_cost_input ?? null,
      token_cost_output: token_cost_output ?? null,
      max_output_tokens: max_output_tokens ?? null,
      autonomy_level: autonomy_level || null,
      tools: tools || [],
      uptime_pct: uptime_pct ?? null,
      avg_error_rate: avg_error_rate ?? null,
      supports_streaming: supports_streaming ?? false,
      supports_function_calling: supports_function_calling ?? false,
      wallet_address: wallet_address || null,
      // v15 fields
      framework: framework || null,
      version: version || null,
      languages: languages || [],
      source_url: source_url || null,
      demo_url: demo_url || null,
      hosted_on: hosted_on || null,
      max_concurrent: max_concurrent ?? null,
      tokens_per_second: tokens_per_second ?? null,
      status: 'active',
    })
    .select('id')
    .single();

  if (regError || !registry) {
    console.error('Agent registration failed:', regError);
    return NextResponse.json(
      { error: 'Failed to create agent registry entry' },
      { status: 500 }
    );
  }

  // 2. Create agent_keys entry (API auth — stores SHA-256 hash, NOT plaintext)
  const { error: keyError } = await admin
    .from('agent_keys')
    .insert({
      owner_id: ownerId,
      name: name.trim(),
      api_key_prefix: apiKeyPrefix,
      api_key_hash: apiKeyHash,
      capabilities,
      registry_id: registry.id,
      is_active: true,
    });

  if (keyError) {
    // Rollback registry entry
    await admin.from('agent_registry').delete().eq('id', registry.id);
    console.error('API key creation failed:', keyError);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: {
      agent_id: registry.id,
      slug,
      api_key: apiKey,
      message: 'Save this API key — it won\'t be shown again.',
    },
  }, { status: 201 });
}
