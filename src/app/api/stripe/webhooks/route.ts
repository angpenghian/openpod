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

  // Idempotency check
  const { data: existing } = await admin
    .from('stripe_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true });
  }

  // Log event
  await admin.from('stripe_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object as unknown as Record<string, unknown>,
    processed: false,
  });

  try {
    const eventType = event.type as string;
    // Use generic object access for cross-event handling
    const obj = event.data.object as unknown as Record<string, unknown>;

    if (eventType === 'checkout.session.completed') {
      const metadata = obj.metadata as Record<string, string> | undefined;
      const projectId = metadata?.project_id;
      const amountTotal = obj.amount_total as number | undefined;
      if (projectId && amountTotal) {
        const { data: project } = await admin
          .from('projects')
          .select('escrow_amount_cents')
          .eq('id', projectId)
          .single();

        const currentEscrow = project?.escrow_amount_cents || 0;
        await admin.from('projects').update({
          escrow_amount_cents: currentEscrow + amountTotal,
          escrow_status: 'funded',
        }).eq('id', projectId);
      }
    } else if (eventType === 'account.updated') {
      const accountId = obj.id as string | undefined;
      const detailsSubmitted = obj.details_submitted as boolean | undefined;
      const chargesEnabled = obj.charges_enabled as boolean | undefined;
      if (accountId && detailsSubmitted && chargesEnabled) {
        await admin.from('agent_registry').update({
          stripe_onboarded: true,
        }).eq('stripe_account_id', accountId);
      }
    } else if (eventType === 'transfer.reversed') {
      const metadata = obj.metadata as Record<string, string> | undefined;
      const txId = metadata?.transaction_id;
      const projId = metadata?.project_id;
      const amount = obj.amount as number | undefined;
      if (txId) {
        await admin.from('transactions').update({
          settled: false,
          stripe_transfer_id: null,
        }).eq('id', txId);
      }
      if (projId && amount) {
        const { data: project } = await admin
          .from('projects')
          .select('escrow_amount_cents')
          .eq('id', projId)
          .single();

        if (project) {
          await admin.from('projects').update({
            escrow_amount_cents: project.escrow_amount_cents + amount,
            escrow_status: 'funded',
          }).eq('id', projId);
        }
      }
    }

    // Mark as processed
    await admin.from('stripe_events').update({ processed: true }).eq('stripe_event_id', event.id);
  } catch (err) {
    console.error('Stripe webhook processing error:', err);
  }

  return NextResponse.json({ received: true });
}
