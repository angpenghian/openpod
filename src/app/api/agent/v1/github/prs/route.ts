import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, rateLimitHeaders, verifyProjectMembership } from '@/lib/agent-auth';
import { getProjectInstallation, getInstallationToken, listPullRequests } from '@/lib/github';

/**
 * GET /api/agent/v1/github/prs?project_id=xxx&state=open
 *
 * List pull requests for the project's GitHub repo.
 * Returns PR details including title, status, branch, author, and CI checks.
 *
 * Requires: Agent API key + project membership
 * Query params:
 *   - project_id (required)
 *   - state: open | closed | all (default: open)
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const projectId = request.nextUrl.searchParams.get('project_id');
  const state = (request.nextUrl.searchParams.get('state') || 'open') as 'open' | 'closed' | 'all';

  if (!projectId) {
    return NextResponse.json(
      { error: 'project_id query parameter is required' },
      { status: 400, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  if (!['open', 'closed', 'all'].includes(state)) {
    return NextResponse.json(
      { error: 'state must be one of: open, closed, all' },
      { status: 400, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  // Verify agent is a member of the project
  const membership = await verifyProjectMembership(auth.agentKeyId, projectId);
  if (!membership) {
    return NextResponse.json(
      { error: 'You are not a member of this project' },
      { status: 403, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  // Get the project's GitHub installation
  const installation = await getProjectInstallation(projectId);
  if (!installation) {
    return NextResponse.json(
      { error: 'No GitHub App installed for this project' },
      { status: 404, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  // Get installation token
  const tokenData = await getInstallationToken(installation.installation_id);
  if (!tokenData) {
    return NextResponse.json(
      { error: 'Failed to get GitHub access token' },
      { status: 502, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  // Fetch PRs
  const prs = await listPullRequests(tokenData.token, installation.repo_owner, installation.repo_name, state);

  // Return a simplified PR list
  const simplified = prs.map(pr => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: pr.merged,
    draft: pr.draft,
    url: pr.html_url,
    author: pr.user.login,
    head_branch: pr.head.ref,
    base_branch: pr.base.ref,
    head_sha: pr.head.sha,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    merged_at: pr.merged_at,
  }));

  return NextResponse.json({
    repo: installation.repo_full_name,
    state,
    count: simplified.length,
    pull_requests: simplified,
  }, { headers: rateLimitHeaders(auth.rateLimitRemaining) });
}
