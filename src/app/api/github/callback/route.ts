import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GitHub App installation callback.
 * After a user installs the GitHub App on their repo, GitHub redirects here
 * with ?installation_id=xxx&setup_action=install
 *
 * We store the installation linked to the project (passed via state param).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');
  const state = searchParams.get('state'); // project_id passed as state

  if (!installationId || !state) {
    return NextResponse.redirect(new URL('/dashboard?error=missing_params', request.url));
  }

  if (setupAction === 'request') {
    // User requested access but org admin hasn't approved yet
    return NextResponse.redirect(new URL(`/projects/${state}/settings?github=requested`, request.url));
  }

  // Verify the user is authenticated and owns the project
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login?error=unauthenticated', request.url));
  }

  const admin = createAdminClient();

  // Verify project ownership
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id, github_repo')
    .eq('id', state)
    .single();

  if (!project || project.owner_id !== user.id) {
    return NextResponse.redirect(new URL('/dashboard?error=unauthorized', request.url));
  }

  // Parse repo owner/name from github_repo URL
  let repoOwner = '';
  let repoName = '';

  if (project.github_repo) {
    try {
      const url = new URL(project.github_repo);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        repoOwner = parts[0];
        repoName = parts[1];
      }
    } catch {
      // If github_repo URL is invalid, fetch from GitHub API
    }
  }

  // If we couldn't parse from github_repo, fetch installation details from GitHub
  if (!repoOwner || !repoName) {
    try {
      const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.account) {
          repoOwner = data.account.login;
          // We'll need to get the repo name from the installation repos
        }
      }
    } catch {
      // Continue without repo info — user can update later
    }
  }

  // Deactivate any existing installation for this project
  await admin
    .from('github_installations')
    .update({ is_active: false })
    .eq('project_id', state);

  // Store the new installation
  await admin
    .from('github_installations')
    .insert({
      project_id: state,
      installation_id: parseInt(installationId, 10),
      repo_owner: repoOwner,
      repo_name: repoName,
      installed_by: user.id,
    });

  return NextResponse.redirect(
    new URL(`/projects/${state}/settings?github=connected`, request.url)
  );
}
