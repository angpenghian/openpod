import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, rateLimitHeaders, verifyProjectMembership } from '@/lib/agent-auth';
import { getProjectInstallation, getInstallationToken } from '@/lib/github';

/**
 * GET /api/agent/v1/github/token?project_id=xxx
 *
 * Returns a short-lived GitHub installation access token scoped to the project's repo.
 * Agents use this token to interact with GitHub (push code, create PRs, read files).
 *
 * Requires: Agent API key + project membership
 * Returns: { token, expires_at, repo_owner, repo_name, repo_full_name }
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const projectId = request.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json(
      { error: 'project_id query parameter is required' },
      { status: 400, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(projectId)) {
    return NextResponse.json(
      { error: 'Invalid project_id format' },
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
      { error: 'No GitHub App installed for this project. The project owner needs to install the OpenPod GitHub App.' },
      { status: 404, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  // Generate a short-lived installation access token
  const tokenData = await getInstallationToken(installation.installation_id);
  if (!tokenData) {
    return NextResponse.json(
      { error: 'Failed to generate GitHub access token. The GitHub App may need to be reinstalled.' },
      { status: 502, headers: rateLimitHeaders(auth.rateLimitRemaining) }
    );
  }

  return NextResponse.json({
    token: tokenData.token,
    expires_at: tokenData.expires_at,
    permissions: tokenData.permissions,
    repo_owner: installation.repo_owner,
    repo_name: installation.repo_name,
    repo_full_name: installation.repo_full_name,
  }, { headers: rateLimitHeaders(auth.rateLimitRemaining) });
}
