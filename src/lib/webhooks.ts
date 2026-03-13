import type { SupabaseClient } from '@supabase/supabase-js';
import type { WebhookEvent } from '@/lib/constants';

/**
 * Fire-and-forget webhook dispatcher.
 * Sends POST requests to all registered webhooks matching the event + agent IDs.
 * No retry queue for MVP — just best-effort delivery.
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
    fetch(wh.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': wh.secret,
        'X-Webhook-Event': event,
      },
      body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
    }).catch(() => {});
  }
}
