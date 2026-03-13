import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { X402_CONFIG, buildPaymentRequired, verifyX402Payment } from '@/lib/x402';
import { COMMISSION_RATE } from '@/lib/constants';
import { fireWebhooks } from '@/lib/webhooks';

// POST /api/agent/v1/services/[agentSlug]/invoke — Call another agent's service (x402 payment required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentSlug: string }> }
) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  if (!auth.registryId) {
    return NextResponse.json({ error: 'No registry entry found' }, { status: 404 });
  }

  const { agentSlug } = await params;
  if (!agentSlug || !/^[a-z0-9-]+$/.test(agentSlug)) {
    return NextResponse.json({ error: 'Invalid agent slug' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { input } = body as { input?: string };
  if (!input || typeof input !== 'string') {
    return NextResponse.json({ error: 'input is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up target agent by slug
  const { data: targetAgent } = await admin
    .from('agent_registry')
    .select('id, name, slug, wallet_address, pricing_cents, pricing_type, capabilities')
    .eq('slug', agentSlug)
    .eq('status', 'active')
    .single();

  if (!targetAgent) {
    return NextResponse.json({ error: 'Agent not found or inactive' }, { status: 404 });
  }

  // Can't invoke yourself
  if (targetAgent.id === auth.registryId) {
    return NextResponse.json({ error: 'Cannot invoke yourself' }, { status: 400 });
  }

  if (!targetAgent.wallet_address) {
    return NextResponse.json({ error: 'Target agent has no wallet configured for payments' }, { status: 400 });
  }

  // Calculate price
  const priceUsdc = targetAgent.pricing_cents / 100;
  const commissionUsdc = priceUsdc * COMMISSION_RATE;
  const totalUsdc = priceUsdc + commissionUsdc;

  // Check for x402 payment header
  const paymentHeader = request.headers.get('x-payment');

  if (!paymentHeader) {
    return NextResponse.json(
      {
        error: 'Payment required',
        agent: {
          id: targetAgent.id,
          name: targetAgent.name,
          slug: targetAgent.slug,
          capabilities: targetAgent.capabilities,
          pricing_type: targetAgent.pricing_type,
        },
        payment_details: buildPaymentRequired(
          targetAgent.wallet_address,
          totalUsdc,
          `Invoke ${targetAgent.name}: ${input.slice(0, 100)}`,
        ),
      },
      { status: 402 }
    );
  }

  // Verify payment
  const verification = await verifyX402Payment(paymentHeader, targetAgent.wallet_address, totalUsdc);
  if (!verification) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 402 });
  }

  // Log x402 payment
  await admin.from('x402_payments').insert({
    payer_agent_id: auth.registryId,
    payee_agent_id: targetAgent.id,
    amount_usdc: priceUsdc,
    commission_usdc: commissionUsdc,
    network: X402_CONFIG.network,
    tx_hash: verification.txHash,
    status: verification.settled ? 'settled' : 'pending',
    description: `Service invocation: ${input.slice(0, 200)}`,
    settled_at: verification.settled ? new Date().toISOString() : null,
  });

  // Also log in transactions table
  await admin.from('transactions').insert({
    agent_registry_id: targetAgent.id,
    amount_cents: Math.round(priceUsdc * 100),
    commission_cents: Math.round(commissionUsdc * 100),
    type: 'deliverable_approved',
    description: `x402 service: ${targetAgent.name} — ${input.slice(0, 200)}`,
    payment_rail: 'x402',
    x402_tx_hash: verification.txHash,
    settled: verification.settled,
    settled_at: verification.settled ? new Date().toISOString() : null,
  });

  // Fire webhook to target agent
  const { data: targetKey } = await admin
    .from('agent_keys')
    .select('id')
    .eq('registry_id', targetAgent.id)
    .limit(1)
    .single();

  if (targetKey) {
    fireWebhooks(admin, 'x402_payment_received', [targetKey.id], {
      from_agent_id: auth.registryId,
      input,
      amount_usdc: priceUsdc,
      tx_hash: verification.txHash,
      service: 'invoke',
    });
  }

  return NextResponse.json({
    data: {
      invocation_accepted: true,
      target_agent: { id: targetAgent.id, name: targetAgent.name, slug: targetAgent.slug },
      payment: {
        amount_usdc: priceUsdc,
        commission_usdc: commissionUsdc,
        tx_hash: verification.txHash,
        settled: verification.settled,
      },
    },
  });
}
