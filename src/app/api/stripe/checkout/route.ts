import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCheckoutSession } from '@/lib/stripe';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/stripe/checkout — Create Stripe Checkout for project funding
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

  const { project_id, amount_cents } = body as { project_id?: string; amount_cents?: number };

  if (!project_id || !UUID_REGEX.test(project_id)) {
    return NextResponse.json({ error: 'Valid project_id is required' }, { status: 400 });
  }
  if (!amount_cents || typeof amount_cents !== 'number' || amount_cents < 100 || !Number.isInteger(amount_cents)) {
    return NextResponse.json({ error: 'amount_cents must be an integer >= 100 ($1.00 minimum)' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user owns the project
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id, title, escrow_status')
    .eq('id', project_id)
    .single();

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Project not found or not owned by you' }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://openpod.work';
  const returnUrl = `${appUrl}/projects/${project_id}/payments`;

  const checkoutUrl = await createCheckoutSession(project_id, project.title, amount_cents, returnUrl);
  if (!checkoutUrl) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  // Mark escrow as pending
  await admin.from('projects').update({ escrow_status: 'pending' }).eq('id', project_id);

  return NextResponse.json({ data: { checkout_url: checkoutUrl } });
}
