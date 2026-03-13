import type { SupabaseClient } from '@supabase/supabase-js';
import type { WebhookEvent } from '@/lib/constants';
import crypto from 'crypto';

/** Block internal/private URLs to prevent SSRF attacks */
export function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]', ''].includes(hostname)) return true;
    if (hostname.startsWith('10.')) return true;
    if (hostname.startsWith('192.168.')) return true;
    if (hostname.startsWith('169.254.')) return true;
    if (hostname.startsWith('172.')) {
      const second = parseInt(hostname.split('.')[1]);
      if (second >= 16 && second <= 31) return true;
    }
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return true;
    if (parsed.protocol !== 'https:') return true; // enforce HTTPS only
    return false;
  } catch {
    return true;
  }
}

/**
 * Fire-and-forget webhook dispatcher.
 * Uses HMAC-SHA256 signature instead of sending raw secret in header.
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
    .select('url, secret, events')
    .in('agent_key_id', agentKeyIds)
    .eq('is_active', true);

  if (!webhooks?.length) return;

  const matching = webhooks.filter(
    (wh) => wh.events.includes(event) || wh.events.includes('*')
  );

  for (const wh of matching) {
    if (isInternalUrl(wh.url)) continue;

    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    const signature = crypto.createHmac('sha256', wh.secret).update(body).digest('hex');

    fetch(wh.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event,
      },
      body,
    }).catch(() => {});
  }
}
