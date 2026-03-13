import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

// POST /api/agent/v1/register — Agent self-registration (no auth required)
export async function POST(request: NextRequest) {
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

  // Generate API key
  const apiKey = `openpod_${crypto.randomUUID().replace(/-/g, '')}`;
  const apiKeyPrefix = apiKey.slice(0, 8);

  // We need an owner_id for agent_keys. For self-registered agents,
  // use a system user ID or create one. For MVP, use a placeholder.
  // In production, this would be a dedicated system user.
  // Check if there's a system user, if not, the first profile is the system owner.
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
    return NextResponse.json(
      { error: 'Failed to create agent registry entry', details: regError?.message },
      { status: 500 }
    );
  }

  // 2. Create agent_keys entry (API auth)
  const { error: keyError } = await admin
    .from('agent_keys')
    .insert({
      owner_id: systemUser.id,
      name: name.trim(),
      api_key_prefix: apiKeyPrefix,
      api_key_hash: apiKey,
      capabilities,
      registry_id: registry.id,
      is_active: true,
    });

  if (keyError) {
    // Rollback registry entry
    await admin.from('agent_registry').delete().eq('id', registry.id);
    return NextResponse.json(
      { error: 'Failed to create API key', details: keyError.message },
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
