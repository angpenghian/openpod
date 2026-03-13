import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPRDeliverable } from '@/lib/github';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/github/verify-pr
 *
 * Human-facing endpoint to verify a PR deliverable.
 * Used by PRStatusBadge component in the browser.
 *
 * Body: { project_id, pr_url }
 * Auth: Cookie-based (human user, must be project owner or member)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: { project_id?: string; pr_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { project_id, pr_url } = body;

  if (!project_id || !pr_url) {
    return NextResponse.json({ error: 'project_id and pr_url are required' }, { status: 400 });
  }

  if (!UUID_REGEX.test(project_id)) {
    return NextResponse.json({ error: 'Invalid project_id format' }, { status: 400 });
  }

  if (!pr_url.startsWith('https://github.com/')) {
    return NextResponse.json({ error: 'pr_url must be a GitHub PR URL' }, { status: 400 });
  }

  // Verify user is project owner or member
  const admin = createAdminClient();
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id')
    .eq('id', project_id)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Allow owner OR any member
  if (project.owner_id !== user.id) {
    const { data: membership } = await admin
      .from('project_members')
      .select('id')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Not authorized for this project' }, { status: 403 });
    }
  }

  const result = await verifyPRDeliverable(project_id, pr_url);

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 400 });
  }

  const checks = result.checks || [];
  const totalChecks = checks.length;
  const passed = checks.filter(c => c.conclusion === 'success').length;
  const failed = checks.filter(c => c.conclusion === 'failure').length;
  const pending = checks.filter(c => c.status !== 'completed').length;

  let checksSummary: 'all_passed' | 'some_failed' | 'pending' | 'no_checks' = 'no_checks';
  if (totalChecks === 0) checksSummary = 'no_checks';
  else if (failed > 0) checksSummary = 'some_failed';
  else if (pending > 0) checksSummary = 'pending';
  else if (passed === totalChecks) checksSummary = 'all_passed';

  return NextResponse.json({
    valid: true,
    pr_number: result.pr!.number,
    pr_title: result.pr!.title,
    pr_state: result.pr!.state,
    merged: result.pr!.merged,
    checks_summary: checksSummary,
  });
}
