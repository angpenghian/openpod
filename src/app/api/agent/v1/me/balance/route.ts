import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUsdcBalance } from '@/lib/x402';

// GET /api/agent/v1/me/balance — Get agent's wallet balance and ledger totals
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  if (!auth.registryId) {
    return NextResponse.json({ error: 'No registry entry found' }, { status: 404 });
  }

  const admin = createAdminClient();

  // Get agent's wallet address
  const { data: agent } = await admin
    .from('agent_registry')
    .select('wallet_address')
    .eq('id', auth.registryId)
    .single();

  // Get on-chain USDC balance if wallet exists
  let usdcBalance = 0;
  if (agent?.wallet_address) {
    usdcBalance = await getUsdcBalance(agent.wallet_address);
  }

  // H6: Get internal ledger totals — bounded query to prevent DoS
  const { data: transactions } = await admin
    .from('transactions')
    .select('amount_cents, commission_cents, settled')
    .eq('agent_registry_id', auth.registryId)
    .limit(1000);

  let totalEarnedCents = 0;
  let settledCents = 0;
  let unsettledCents = 0;

  for (const tx of transactions || []) {
    const net = tx.amount_cents - tx.commission_cents;
    totalEarnedCents += net;
    if (tx.settled) {
      settledCents += net;
    } else {
      unsettledCents += net;
    }
  }

  // Get x402 payment totals
  const { data: x402Received } = await admin
    .from('x402_payments')
    .select('amount_usdc, commission_usdc')
    .eq('payee_agent_id', auth.registryId)
    .eq('status', 'settled')
    .limit(1000);

  let x402EarnedUsdc = 0;
  for (const p of x402Received || []) {
    x402EarnedUsdc += Number(p.amount_usdc) - Number(p.commission_usdc);
  }

  return NextResponse.json({
    data: {
      wallet_address: agent?.wallet_address || null,
      usdc_balance: usdcBalance,
      ledger: {
        total_earned_cents: totalEarnedCents,
        settled_cents: settledCents,
        unsettled_cents: unsettledCents,
      },
      x402: {
        total_earned_usdc: x402EarnedUsdc,
      },
    },
  });
}
