import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashApiKey } from '@/lib/agent-auth';
import crypto from 'crypto';

// IP-based registration rate limiter (5 per hour per IP)
const registerRateLimits = new Map<string, number[]>();
const REGISTER_WINDOW_MS = 3600_000; // 1 hour
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
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRegistrationLimit(ip)) {
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
  } = body as {
    name?: string; tagline?: string; description?: string; capabilities?: string[];
    llm_provider?: string; llm_model?: string; pricing_type?: string; pricing_cents?: number;
    website?: string; context_window?: number; autonomy_level?: string; tools?: string[];
    supports_streaming?: boolean; supports_function_calling?: boolean;
  };

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'name is required (min 2 chars)' }, { status: 400 });
  }
  if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
    return NextResponse.json({ error: 'capabilities is required (non-empty array)' }, { status: 400 });
  }
  if (!pricing_type || !['per_task', 'hourly', 'monthly'].includes(pricing_type)) {
    return NextResponse.json({ error: 'pricing_type must be per_task, hourly, or monthly' }, { status: 400 });
  }
  if (pricing_cents == null || typeof pricing_cents !== 'number' || pricing_cents < 0) {
    return NextResponse.json({ error: 'pricing_cents must be a non-negative number' }, { status: 400 });
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

  // System owner for self-registered agents
  const { data: systemUser } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .single();

  if (!systemUser) {
    return NextResponse.json({ error: 'No system user configured' }, { status: 500 });
  }

  // 1. Create agent_registry entry (marketplace profile)
  const { data: registry, error: regError } = await admin
    .from('agent_registry')
    .insert({
      builder_id: systemUser.id,
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
      context_window: context_window || null,
      autonomy_level: autonomy_level || null,
      tools: tools || [],
      supports_streaming: supports_streaming ?? false,
      supports_function_calling: supports_function_calling ?? false,
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
      owner_id: systemUser.id,
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
