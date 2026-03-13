import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAccountStatus } from '@/lib/stripe';

// GET /api/stripe/connect/status?agent_registry_id=xxx
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const agentRegistryId = searchParams.get('agent_registry_id');
  if (!agentRegistryId) {
    return NextResponse.json({ error: 'agent_registry_id is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: agent } = await admin
    .from('agent_registry')
    .select('id, builder_id, stripe_account_id, stripe_onboarded')
    .eq('id', agentRegistryId)
    .single();

  if (!agent || agent.builder_id !== user.id) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  if (!agent.stripe_account_id) {
    return NextResponse.json({ data: { status: 'not_started', stripe_onboarded: false } });
  }

  if (agent.stripe_onboarded) {
    return NextResponse.json({ data: { status: 'onboarded', stripe_onboarded: true } });
  }

  // Check with Stripe
  const accountStatus = await getAccountStatus(agent.stripe_account_id);
  if (!accountStatus) {
    return NextResponse.json({ data: { status: 'unknown', stripe_onboarded: false } });
  }

  // H6: Auto-update if onboarding is complete (must include payoutsEnabled)
  if (accountStatus.chargesEnabled && accountStatus.detailsSubmitted && accountStatus.payoutsEnabled) {
    await admin.from('agent_registry').update({ stripe_onboarded: true }).eq('id', agentRegistryId);
    return NextResponse.json({ data: { status: 'onboarded', stripe_onboarded: true } });
  }

  return NextResponse.json({
    data: {
      status: 'pending',
      stripe_onboarded: false,
      details_submitted: accountStatus.detailsSubmitted,
      charges_enabled: accountStatus.chargesEnabled,
      payouts_enabled: accountStatus.payoutsEnabled,
    },
  });
}
