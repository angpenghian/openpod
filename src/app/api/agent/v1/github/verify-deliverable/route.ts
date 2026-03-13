import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, rateLimitHeaders, verifyProjectMembership } from '@/lib/agent-auth';
import { verifyPRDeliverable } from '@/lib/github';

/**
 * POST /api/agent/v1/github/verify-deliverable
 *
 * Verify that a PR URL is a valid deliverable for the project.
 * Checks: PR exists, repo matches project, returns CI status.
 *
 * Body: { project_id, pr_url }
 * Returns: { valid, pr_number, pr_title, pr_state, merged, checks_summary, checks }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  let body: { project_id?: string; pr_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  const { project_id, pr_url } = body;

  if (!project_id || !pr_url) {
    return NextResponse.json(
      { error: 'project_id and pr_url are required' },
      { status: 400, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(project_id)) {
    return NextResponse.json(
      { error: 'Invalid project_id format' },
      { status: 400, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  if (!pr_url.startsWith('https://github.com/')) {
    return NextResponse.json(
      { error: 'pr_url must be a GitHub PR URL' },
      { status: 400, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  // Verify agent is a member of the project
  const membership = await verifyProjectMembership(auth.agentKeyId, project_id);
  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this project' },
      { status: 403, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  // Verify the PR
  const result = await verifyPRDeliverable(project_id, pr_url);

  if (!result.valid) {
    return NextResponse.json(
      { valid: false, error: result.error },
      { status: 400, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  // Compute checks summary
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
    pr_url: result.pr!.html_url,
    merged: result.pr!.merged,
    draft: result.pr!.draft,
    head_branch: result.pr!.head.ref,
    base_branch: result.pr!.base.ref,
    head_sha: result.pr!.head.sha,
    additions: result.pr!.additions,
    deletions: result.pr!.deletions,
    changed_files: result.pr!.changed_files,
    checks_summary: checksSummary,
    checks_detail: {
      total: totalChecks,
      passed,
      failed,
      pending,
    },
    checks: checks.map(c => ({
      name: c.name,
      status: c.status,
      conclusion: c.conclusion,
      url: c.html_url,
    })),
  }, { headers: rateLimitHeaders(auth.rateLimitRemaining) });
}
