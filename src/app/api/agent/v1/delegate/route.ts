import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { X402_CONFIG, buildPaymentRequired, verifyX402Payment } from '@/lib/x402';
import { COMMISSION_RATE } from '@/lib/constants';
import { fireWebhooks } from '@/lib/webhooks';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/agent/v1/delegate — Delegate a subtask to another agent (x402 payment required)
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  if (!auth.registryId) {
    return NextResponse.json({ error: 'No registry entry found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { target_agent_id, task, project_id, ticket_id } = body as {
    target_agent_id?: string;
    task?: string;
    project_id?: string;
    ticket_id?: string;
  };

  if (!target_agent_id || !UUID_REGEX.test(target_agent_id)) {
    return NextResponse.json({ error: 'Valid target_agent_id is required' }, { status: 400 });
  }
  if (!task || typeof task !== 'string' || task.trim().length < 5) {
    return NextResponse.json({ error: 'task is required (min 5 chars)' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up target agent
  const { data: targetAgent } = await admin
    .from('agent_registry')
    .select('id, name, slug, wallet_address, pricing_cents, pricing_type')
    .eq('id', target_agent_id)
    .eq('status', 'active')
    .single();

  if (!targetAgent) {
    return NextResponse.json({ error: 'Target agent not found or inactive' }, { status: 404 });
  }

  // H2: Prevent self-delegation
  if (targetAgent.id === auth.registryId) {
    return NextResponse.json({ error: 'Cannot delegate to yourself' }, { status: 400 });
  }

  if (!targetAgent.wallet_address) {
    return NextResponse.json({ error: 'Target agent has no wallet configured' }, { status: 400 });
  }

  // Calculate price in USDC (convert cents to dollars)
  const priceUsdc = targetAgent.pricing_cents / 100;
  const commissionUsdc = priceUsdc * COMMISSION_RATE;
  const totalUsdc = priceUsdc + commissionUsdc;

  // Check for x402 payment header
  const paymentHeader = request.headers.get('x-payment');

  if (!paymentHeader) {
    // Return 402 Payment Required
    return NextResponse.json(
      {
        error: 'Payment required',
        payment_details: buildPaymentRequired(
          targetAgent.wallet_address,
          totalUsdc,
          `Delegate task to ${targetAgent.name}: ${task.slice(0, 100)}`,
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
    description: `Delegated: ${task.slice(0, 200)}`,
    project_id: project_id && UUID_REGEX.test(project_id) ? project_id : null,
    ticket_id: ticket_id && UUID_REGEX.test(ticket_id) ? ticket_id : null,
    settled_at: verification.settled ? new Date().toISOString() : null,
  });

  // Also log in transactions table for unified ledger
  await admin.from('transactions').insert({
    project_id: project_id && UUID_REGEX.test(project_id) ? project_id : null,
    ticket_id: ticket_id && UUID_REGEX.test(ticket_id) ? ticket_id : null,
    agent_registry_id: targetAgent.id,
    amount_cents: Math.round(priceUsdc * 100),
    commission_cents: Math.round(commissionUsdc * 100),
    type: 'deliverable_approved',
    description: `x402 delegation: ${task.slice(0, 200)}`,
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
      task,
      amount_usdc: priceUsdc,
      tx_hash: verification.txHash,
      project_id: project_id || null,
      ticket_id: ticket_id || null,
    });
  }

  return NextResponse.json({
    data: {
      delegation_accepted: true,
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
