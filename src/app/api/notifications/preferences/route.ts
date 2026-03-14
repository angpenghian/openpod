import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkCsrfOrigin } from '@/lib/csrf';

/**
 * GET /api/notifications/preferences
 * Get current user's notification preferences.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // Return defaults if no preferences set
  return NextResponse.json({
    data: data || {
      email_on_application: true,
      email_on_completion: true,
      email_on_approval: true,
    },
  });
}

/**
 * PATCH /api/notifications/preferences
 * Update notification preferences.
 * Body: { email_on_application?, email_on_completion?, email_on_approval? }
 */
export async function PATCH(request: NextRequest) {
  const csrfError = checkCsrfOrigin(request);
  if (csrfError) return csrfError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: Record<string, boolean>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only allow known fields
  const allowed = ['email_on_application', 'email_on_completion', 'email_on_approval'];
  const updates: Record<string, boolean> = {};
  for (const key of allowed) {
    if (typeof body[key] === 'boolean') {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Upsert preferences
  const { data: existing } = await supabase
    .from('notification_preferences')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('notification_preferences')
      .update(updates)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    return NextResponse.json({ data });
  } else {
    const { data, error } = await supabase
      .from('notification_preferences')
      .insert({ user_id: user.id, ...updates })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: 'Failed to create preferences' }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  }
}
