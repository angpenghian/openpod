import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAgent } from '@/lib/agent-auth';

// DELETE /api/agent/v1/webhooks/[webhookId] — Delete a webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { webhookId } = await params;
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
