import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { constructEvent } from '@/lib/stripe';

// POST /api/stripe/webhooks — Stripe webhook handler
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const event = constructEvent(body, signature);
  if (!event) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  // H4: Atomic idempotency — insert first, unique index on stripe_event_id prevents duplicates
  const { error: insertError } = await admin.from('stripe_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object as unknown as Record<string, unknown>,
    processed: false,
  });

  if (insertError) {
    // Unique constraint violation = already processed (concurrent webhook delivery)
    if (insertError.code === '23505') {
      return NextResponse.json({ received: true });
    }
    console.error('Failed to log Stripe event:', insertError);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  try {
    const eventType = event.type as string;
    // Use generic object access for cross-event handling
    const obj = event.data.object as unknown as Record<string, unknown>;

    if (eventType === 'checkout.session.completed') {
      const metadata = obj.metadata as Record<string, string> | undefined;
      const projectId = metadata?.project_id;
      const amountTotal = obj.amount_total as number | undefined;
      const paymentStatus = obj.payment_status as string | undefined;
      if (projectId && amountTotal && paymentStatus === 'paid') {
        // Atomic escrow increment (prevents race conditions)
        const { error: escrowError } = await admin.rpc('increment_escrow', {
          p_project_id: projectId,
          p_amount: amountTotal,
        });
        if (escrowError) {
          console.error('Failed to increment escrow:', escrowError);
        }
      }
    } else if (eventType === 'account.updated') {
      const accountId = obj.id as string | undefined;
      const detailsSubmitted = obj.details_submitted as boolean | undefined;
      const chargesEnabled = obj.charges_enabled as boolean | undefined;
      const payoutsEnabled = obj.payouts_enabled as boolean | undefined;
      if (accountId && detailsSubmitted && chargesEnabled && payoutsEnabled) {
        await admin.from('agent_registry').update({
          stripe_onboarded: true,
        }).eq('stripe_account_id', accountId);
      }
    } else if (eventType === 'transfer.reversed') {
      const metadata = obj.metadata as Record<string, string> | undefined;
      const txId = metadata?.transaction_id;
      const projId = metadata?.project_id;
      // C1: Use gross_payout_cents from metadata (what was deducted from escrow), not obj.amount (net transfer)
      const grossStr = metadata?.gross_payout_cents;
      const refundAmount = grossStr ? parseInt(grossStr, 10) : (obj.amount as number | undefined);
      if (txId) {
        await admin.from('transactions').update({
          settled: false,
          stripe_transfer_id: null,
        }).eq('id', txId);
      }
      if (projId && refundAmount && refundAmount > 0) {
        // Atomic escrow refund on transfer reversal — refund the GROSS amount
        const { error: refundError } = await admin.rpc('increment_escrow', {
          p_project_id: projId,
          p_amount: refundAmount,
        });
        if (refundError) {
          console.error('Failed to refund escrow on transfer reversal:', refundError);
        }
      }
    }

    // Mark as processed
    await admin.from('stripe_events').update({ processed: true }).eq('stripe_event_id', event.id);
  } catch (err) {
    console.error('Stripe webhook processing error:', err);
    // C1: Return 500 so Stripe retries (returning 200 on failure silently drops the event)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
