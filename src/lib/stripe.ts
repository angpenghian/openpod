import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

// Stripe client singleton — only initialized when env var exists
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
    });
  }
  return stripeClient;
}

// --- Express Account Onboarding ---

export async function createExpressAccount(agentName: string): Promise<{ accountId: string; onboardingUrl: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const account = await stripe.accounts.create({
    type: 'express',
    metadata: { source: 'openpod' },
    business_profile: {
      name: agentName,
      product_description: 'AI agent services on OpenPod',
    },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://openpod.work'}/agents/onboarding-refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://openpod.work'}/agents/onboarding-complete?account=${account.id}`,
    type: 'account_onboarding',
  });

  return { accountId: account.id, onboardingUrl: accountLink.url };
}

export async function getAccountStatus(accountId: string): Promise<{ detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const account = await stripe.accounts.retrieve(accountId);
  return {
    detailsSubmitted: account.details_submitted ?? false,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
  };
}

// --- Project Funding (Escrow) ---

export async function createCheckoutSession(
  projectId: string,
  projectTitle: string,
  amountCents: number,
  returnUrl: string,
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Fund project: ${projectTitle}`,
          description: 'Escrow deposit for AI agent work on OpenPod',
        },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    payment_intent_data: {
      transfer_group: `project_${projectId}`,
      metadata: { project_id: projectId },
    },
    metadata: { project_id: projectId },
    success_url: `${returnUrl}?funded=true`,
    cancel_url: `${returnUrl}?funded=false`,
  });

  return session.url;
}

// --- Payout Transfer ---

export async function settleStripeTransfer(
  admin: SupabaseClient,
  transactionId: string,
  assigneeAgentKeyId: string | null,
  payoutCents: number,
  commissionCents: number,
  project: { id: string; escrow_amount_cents: number },
): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe || !assigneeAgentKeyId) return false;

  // Look up agent's Stripe account via agent_key → agent_registry
  const { data: agentKey } = await admin
    .from('agent_keys')
    .select('registry_id')
    .eq('id', assigneeAgentKeyId)
    .single();

  if (!agentKey?.registry_id) return false;

  const { data: agent } = await admin
    .from('agent_registry')
    .select('stripe_account_id, stripe_onboarded')
    .eq('id', agentKey.registry_id)
    .single();

  if (!agent?.stripe_onboarded || !agent.stripe_account_id) return false;

  const netPayoutCents = payoutCents - commissionCents;

  try {
    const transfer = await stripe.transfers.create({
      amount: netPayoutCents,
      currency: 'usd',
      destination: agent.stripe_account_id,
      transfer_group: `project_${project.id}`,
      metadata: {
        transaction_id: transactionId,
        project_id: project.id,
      },
    });

    // Update transaction as settled
    await admin.from('transactions').update({
      payment_rail: 'stripe',
      stripe_transfer_id: transfer.id,
      settled: true,
      settled_at: new Date().toISOString(),
    }).eq('id', transactionId);

    // Atomic escrow deduction (prevents race conditions / overdraw)
    const { data: deducted, error: deductError } = await admin.rpc('deduct_escrow', {
      p_project_id: project.id,
      p_amount: payoutCents,
    });
    if (deductError || !deducted) {
      console.error('Atomic escrow deduction failed after Stripe transfer:', deductError);
      // Transfer succeeded but escrow update failed — log for manual reconciliation
    }

    return true;
  } catch (err) {
    console.error('Stripe transfer failed:', err);
    return false;
  }
}

// --- Webhook Signature Verification ---

export function constructEvent(payload: string | Buffer, signature: string): Stripe.Event | null {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return null;

  try {
    return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return null;
  }
}
