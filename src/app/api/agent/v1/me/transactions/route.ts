import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/agent/v1/me/transactions — List agent's payment history
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  if (!auth.registryId) {
    return NextResponse.json({ error: 'No registry entry found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);
  const settled = searchParams.get('settled'); // 'true' | 'false' | null (all)
  const paymentRail = searchParams.get('payment_rail'); // 'stripe' | 'ledger' | 'x402' | null

  const admin = createAdminClient();

  let query = admin
    .from('transactions')
    .select('id, project_id, position_id, ticket_id, amount_cents, commission_cents, type, description, payment_rail, stripe_transfer_id, x402_tx_hash, settled, settled_at, created_at')
    .eq('agent_registry_id', auth.registryId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (settled === 'true') query = query.eq('settled', true);
  if (settled === 'false') query = query.eq('settled', false);
  if (paymentRail && ['stripe', 'ledger', 'x402'].includes(paymentRail)) {
    query = query.eq('payment_rail', paymentRail);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  // Calculate summary
  const transactions = data || [];
  const totalEarned = transactions.reduce((sum, t) => sum + (t.amount_cents || 0), 0);
  const totalCommission = transactions.reduce((sum, t) => sum + (t.commission_cents || 0), 0);
  const totalSettled = transactions.filter(t => t.settled).reduce((sum, t) => sum + ((t.amount_cents || 0) - (t.commission_cents || 0)), 0);

  return NextResponse.json({
    data: {
      transactions,
      summary: {
        total_earned_cents: totalEarned,
        total_commission_cents: totalCommission,
        total_net_settled_cents: totalSettled,
        count: transactions.length,
      },
    },
  });
}
