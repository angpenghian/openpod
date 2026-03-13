import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');

/**
 * Generate a JWT for the GitHub App (RS256, 10 min expiry).
 * Used to request installation access tokens.
 */
function generateAppJWT(): string {
  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY) {
    throw new Error('GITHUB_APP_ID and GITHUB_PRIVATE_KEY must be set');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 60, // issued at (60s in the past for clock drift)
    exp: now + 600, // expires in 10 minutes (max allowed by GitHub)
    iss: GITHUB_APP_ID,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(GITHUB_PRIVATE_KEY, 'base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Get a short-lived installation access token for a specific GitHub App installation.
 * This token can be used to interact with the repo on behalf of the app.
 */
export async function getInstallationToken(installationId: number): Promise<{
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
} | null> {
  const jwt = generateAppJWT();

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!res.ok) return null;
  return res.json();
}

/**
 * Get the GitHub installation for a project.
 * Returns null if no active installation exists.
 */
export async function getProjectInstallation(projectId: string): Promise<{
  installation_id: number;
  repo_owner: string;
  repo_name: string;
  repo_full_name: string;
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('github_installations')
    .select('installation_id, repo_owner, repo_name, repo_full_name')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .single();

  return data;
}

/**
 * List pull requests for a repo using an installation token.
 */
export async function listPullRequests(
  token: string,
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<GitHubPR[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=30&sort=updated&direction=desc`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!res.ok) return [];
  return res.json();
}

/**
 * Get a specific pull request by number.
 */
export async function getPullRequest(
  token: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubPR | null> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!res.ok) return null;
  return res.json();
}

/**
 * Get check runs (CI status) for a specific commit/ref.
 */
export async function getCheckRuns(
  token: string,
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubCheckRun[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${ref}/check-runs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.check_runs || [];
}

/**
 * Verify that a PR URL matches the project's repo and return PR details + CI status.
 */
export async function verifyPRDeliverable(
  projectId: string,
  prUrl: string
): Promise<{
  valid: boolean;
  pr?: GitHubPR;
  checks?: GitHubCheckRun[];
  error?: string;
}> {
  // Parse the PR URL: https://github.com/owner/repo/pull/123
  const prMatch = prUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)$/);
  if (!prMatch) {
    return { valid: false, error: 'Invalid PR URL format. Expected: https://github.com/owner/repo/pull/123' };
  }

  const [, urlOwner, urlRepo, prNumberStr] = prMatch;
  const prNumber = parseInt(prNumberStr, 10);

  // Get the project's GitHub installation
  const installation = await getProjectInstallation(projectId);
  if (!installation) {
    return { valid: false, error: 'No GitHub App installed for this project' };
  }

  // Verify the PR URL matches the project's repo
  if (urlOwner !== installation.repo_owner || urlRepo !== installation.repo_name) {
    return { valid: false, error: `PR repo (${urlOwner}/${urlRepo}) does not match project repo (${installation.repo_full_name})` };
  }

  // Get installation token
  const tokenData = await getInstallationToken(installation.installation_id);
  if (!tokenData) {
    return { valid: false, error: 'Failed to get GitHub access token' };
  }

  // Fetch PR details
  const pr = await getPullRequest(tokenData.token, urlOwner, urlRepo, prNumber);
  if (!pr) {
    return { valid: false, error: `PR #${prNumber} not found in ${urlOwner}/${urlRepo}` };
  }

  // Fetch CI checks for the PR's head commit
  const checks = await getCheckRuns(tokenData.token, urlOwner, urlRepo, pr.head.sha);

  return { valid: true, pr, checks };
}

// --- Types ---

export interface GitHubPR {
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  html_url: string;
  user: { login: string; avatar_url: string };
  head: { ref: string; sha: string };
  base: { ref: string };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  draft: boolean;
}

export interface GitHubCheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  html_url: string;
  started_at: string | null;
  completed_at: string | null;
}
