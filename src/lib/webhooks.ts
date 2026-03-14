import type { SupabaseClient } from '@supabase/supabase-js';
import type { WebhookEvent } from '@/lib/constants';
import crypto from 'crypto';

/** Block internal/private URLs to prevent SSRF attacks */
export function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block URLs with credentials (username:password@host)
    if (parsed.username || parsed.password) return true;

    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]', ''].includes(hostname)) return true;
    if (hostname.endsWith('.localhost')) return true; // .localhost TLD
    if (hostname.includes('::ffff:')) return true; // IPv6-mapped IPv4
    if (hostname.startsWith('0.')) return true; // 0.x.x.x range
    if (hostname.startsWith('10.')) return true;
    if (hostname.startsWith('192.168.')) return true;
    if (hostname.startsWith('169.254.')) return true;
    if (hostname.startsWith('172.')) {
      const second = parseInt(hostname.split('.')[1], 10);
      if (!Number.isNaN(second) && second >= 16 && second <= 31) return true;
    }
    // IPv6 ULA (fc00::/7) and link-local (fe80::/10)
    if (/^\[?f[cd][0-9a-f]{2}:/i.test(hostname)) return true;
    if (/^\[?fe[89ab][0-9a-f]:/i.test(hostname)) return true;
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return true;
    if (parsed.protocol !== 'https:') return true; // enforce HTTPS only
    return false;
  } catch {
    return true;
  }
}

/** Retry backoff intervals in ms: 1min, 5min, 15min */
const RETRY_DELAYS_MS = [60_000, 300_000, 900_000];
const MAX_ATTEMPTS = 3;

/**
 * Webhook dispatcher with delivery logging and retry.
 * Logs every delivery attempt to webhook_deliveries table.
 * Retries failed deliveries up to 3 times with exponential backoff.
 */
export async function fireWebhooks(
  db: SupabaseClient,
  event: WebhookEvent,
  agentKeyIds: string[],
  payload: Record<string, unknown>,
): Promise<void> {
  if (agentKeyIds.length === 0) return;

  const { data: webhooks } = await db
    .from('agent_webhooks')
    .select('id, url, secret, events')
    .in('agent_key_id', agentKeyIds)
    .eq('is_active', true);

  if (!webhooks?.length) return;

  const matching = webhooks.filter(
    (wh) => wh.events.includes(event) || wh.events.includes('*')
  );

  for (const wh of matching) {
    if (isInternalUrl(wh.url)) continue;

    // Fire and don't block the response
    deliverWebhook(db, wh.id, wh.url, wh.secret, event, payload, 1).catch(() => {});
  }
}

/**
 * Deliver a single webhook with logging and retry.
 */
async function deliverWebhook(
  db: SupabaseClient,
  webhookId: string,
  url: string,
  secret: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
  attempt: number,
): Promise<void> {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let status: 'success' | 'failed' = 'failed';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = res.status;

    // Read response body (truncated to 500 chars for storage)
    try {
      const text = await res.text();
      responseBody = text.slice(0, 500);
    } catch {
      responseBody = null;
    }

    // 2xx = success
    if (res.ok) {
      status = 'success';
    }
  } catch {
    // Network error, timeout, etc.
    statusCode = null;
    responseBody = 'Network error or timeout';
  }

  // Compute next retry time
  const nextRetryAt = status === 'failed' && attempt < MAX_ATTEMPTS
    ? new Date(Date.now() + RETRY_DELAYS_MS[attempt - 1]).toISOString()
    : null;

  // Log delivery attempt
  await db.from('webhook_deliveries').insert({
    webhook_id: webhookId,
    event_type: event,
    payload,
    status,
    status_code: statusCode,
    response_body: responseBody,
    attempt,
    next_retry_at: nextRetryAt,
  }).then(() => {});

  // Schedule retry if failed and under max attempts
  if (status === 'failed' && attempt < MAX_ATTEMPTS) {
    const delay = RETRY_DELAYS_MS[attempt - 1];
    setTimeout(() => {
      deliverWebhook(db, webhookId, url, secret, event, payload, attempt + 1).catch(() => {});
    }, delay);
  }
}

/**
 * Process pending retries (called on-demand or via cron).
 * Looks for failed deliveries with next_retry_at in the past.
 * Useful as a backup in case setTimeout doesn't fire (serverless cold start).
 */
export async function processRetries(db: SupabaseClient): Promise<number> {
  const { data: pending } = await db
    .from('webhook_deliveries')
    .select('id, webhook_id, event_type, payload, attempt')
    .eq('status', 'failed')
    .not('next_retry_at', 'is', null)
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(20);

  if (!pending?.length) return 0;

  let processed = 0;
  for (const delivery of pending) {
    // Get webhook URL and secret
    const { data: webhook } = await db
      .from('agent_webhooks')
      .select('url, secret')
      .eq('id', delivery.webhook_id)
      .eq('is_active', true)
      .single();

    if (!webhook) {
      // Webhook deleted or deactivated — mark as failed permanently
      await db.from('webhook_deliveries')
        .update({ next_retry_at: null })
        .eq('id', delivery.id);
      continue;
    }

    // Clear the retry marker before re-attempting
    await db.from('webhook_deliveries')
      .update({ next_retry_at: null })
      .eq('id', delivery.id);

    await deliverWebhook(
      db,
      delivery.webhook_id,
      webhook.url,
      webhook.secret,
      delivery.event_type as WebhookEvent,
      delivery.payload as Record<string, unknown>,
      delivery.attempt + 1,
    );
    processed++;
  }

  return processed;
}
