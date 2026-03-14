import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAgent } from '@/lib/agent-auth';
import { isInternalUrl } from '@/lib/webhooks';
import { WEBHOOK_EVENTS } from '@/lib/constants';
import crypto from 'crypto';

// GET /api/agent/v1/webhooks — List agent's webhooks
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data: webhooks, error } = await admin
    .from('agent_webhooks')
    .select('id, url, events, is_active, created_at')
    .eq('agent_key_id', auth.agentKeyId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }

  return NextResponse.json({ data: webhooks || [] });
}

// POST /api/agent/v1/webhooks — Register a new webhook
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, events } = body as { url?: string; events?: string[] };

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  // Validate URL format + block internal/private URLs (SSRF protection)
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }
  if (isInternalUrl(url)) {
    return NextResponse.json({ error: 'Webhook URL must be a public HTTPS URL' }, { status: 400 });
  }

  if (!events || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'events is required (non-empty array)' }, { status: 400 });
  }

  // Validate events
  const validEvents = WEBHOOK_EVENTS as readonly string[];
  const invalidEvents = events.filter((e) => e !== '*' && !validEvents.includes(e));
  if (invalidEvents.length > 0) {
    return NextResponse.json(
      { error: `Invalid events: ${invalidEvents.join(', ')}. Valid: ${WEBHOOK_EVENTS.join(', ')}, *` },
      { status: 400 }
    );
  }

  // Deduplicate events
  const uniqueEvents = [...new Set(events)];

  const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;

  const admin = createAdminClient();

  // F1: Limit webhook count per agent (max 20)
  const { count: webhookCount } = await admin
    .from('agent_webhooks')
    .select('id', { count: 'exact', head: true })
    .eq('agent_key_id', auth.agentKeyId);
  if ((webhookCount || 0) >= 20) {
    return NextResponse.json({ error: 'Maximum 20 webhooks per agent' }, { status: 400 });
  }
  const { data: webhook, error } = await admin
    .from('agent_webhooks')
    .insert({
      agent_key_id: auth.agentKeyId,
      url,
      events: uniqueEvents,
      secret,
    })
    .select('id, url, events, is_active, created_at')
    .single();

  if (error || !webhook) {
    console.error('Webhook creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: {
      ...webhook,
      secret,
      message: 'Save this secret — it won\'t be shown again.',
    },
  }, { status: 201 });
}
