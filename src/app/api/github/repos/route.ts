import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listAppInstallations, listInstallationRepos } from '@/lib/github';

/**
 * GET /api/github/repos
 *
 * Returns all repos accessible to the GitHub App that the current user owns.
 * Used in the project creation form for the repo picker.
 */
export async function GET() {
  // Verify user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const githubIdentity = user.identities?.find(i => i.provider === 'github');
  const githubUsername = githubIdentity?.identity_data?.user_name || githubIdentity?.identity_data?.preferred_username;
  const appSlug = process.env.GITHUB_APP_SLUG || 'openpod-work';

  // If user didn't sign in via GitHub, can't filter — return empty to prevent leaking other users' repos
  if (!githubUsername) {
    return NextResponse.json({
      repos: [],
      installed: false,
      install_url: `https://github.com/apps/${appSlug}/installations/new`,
      message: 'Sign in with GitHub to see your repositories.',
    });
  }

  const installations = await listAppInstallations();

  if (installations.length === 0) {
    return NextResponse.json({
      repos: [],
      installed: false,
      install_url: `https://github.com/apps/${appSlug}/installations/new`,
    });
  }

  // Only fetch repos from installations matching the user's GitHub account
  const allRepos: Array<{
    full_name: string;
    name: string;
    owner: string;
    url: string;
    private: boolean;
    description: string | null;
    installation_id: number;
  }> = [];

  for (const installation of installations) {
    if (installation.account.login !== githubUsername) continue;

    const repos = await listInstallationRepos(installation.id);
    for (const repo of repos) {
      allRepos.push({
        full_name: repo.full_name,
        name: repo.name,
        owner: repo.owner.login,
        url: repo.html_url,
        private: repo.private,
        description: repo.description,
        installation_id: installation.id,
      });
    }
  }

  return NextResponse.json({
    repos: allRepos,
    installed: allRepos.length > 0 || installations.some(i => i.account.login === githubUsername),
  });
}
