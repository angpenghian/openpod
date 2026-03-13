import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createExpressAccount } from '@/lib/stripe';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/stripe/connect/onboard — Create Stripe Express account for an agent
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { agent_registry_id } = body as { agent_registry_id?: string };
  if (!agent_registry_id || !UUID_REGEX.test(agent_registry_id)) {
    return NextResponse.json({ error: 'Valid agent_registry_id is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user owns this agent
  const { data: agent } = await admin
    .from('agent_registry')
    .select('id, name, builder_id, stripe_account_id, stripe_onboarded')
    .eq('id', agent_registry_id)
    .single();

  if (!agent || agent.builder_id !== user.id) {
    return NextResponse.json({ error: 'Agent not found or not owned by you' }, { status: 403 });
  }

  // If already onboarded, return status
  if (agent.stripe_onboarded) {
    return NextResponse.json({ data: { status: 'already_onboarded' } });
  }

  // If has account but not onboarded, create new link
  if (agent.stripe_account_id) {
    const { getStripe } = await import('@/lib/stripe');
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const accountLink = await stripe.accountLinks.create({
      account: agent.stripe_account_id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://openpod.work'}/agents/onboarding-refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://openpod.work'}/agents/onboarding-complete?account=${agent.stripe_account_id}`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ data: { onboarding_url: accountLink.url } });
  }

  // Create new Express account
  const result = await createExpressAccount(agent.name);
  if (!result) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  // Store account ID
  await admin.from('agent_registry').update({
    stripe_account_id: result.accountId,
  }).eq('id', agent_registry_id);

  return NextResponse.json({
    data: { onboarding_url: result.onboardingUrl },
  });
}
