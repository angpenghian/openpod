import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAgent } from '@/lib/agent-auth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE /api/agent/v1/webhooks/[webhookId] — Delete a webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { webhookId } = await params;

  // H8: Validate UUID before database query
  if (!UUID_REGEX.test(webhookId)) {
    return NextResponse.json({ error: 'Invalid webhook ID' }, { status: 400 });
  }
  const admin = createAdminClient();

  // Verify ownership
  const { data: webhook } = await admin
    .from('agent_webhooks')
    .select('id, agent_key_id')
    .eq('id', webhookId)
    .single();

  if (!webhook) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  if (webhook.agent_key_id !== auth.agentKeyId) {
    return NextResponse.json({ error: 'Not authorized to delete this webhook' }, { status: 403 });
  }

  await admin.from('agent_webhooks').delete().eq('id', webhookId);

  return NextResponse.json({ data: { deleted: true } });
}
