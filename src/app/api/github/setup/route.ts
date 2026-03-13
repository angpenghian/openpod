import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findInstallationForRepo } from '@/lib/github';

/**
 * GitHub App setup — handles TWO cases:
 *
 * Case 1: Called by OpenPod UI with ?project_id=xxx
 *   → Auto-connect if app installed, else redirect to GitHub
 *
 * Case 2: Called by GitHub's post-install redirect with ?installation_id=xxx&state=xxx
 *   → Store the installation linked to the project (same as /api/github/callback)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const installationId = searchParams.get('installation_id');
  const state = searchParams.get('state'); // project_id passed as state from GitHub
  const setupAction = searchParams.get('setup_action');

  // ── Case 2: GitHub's post-install redirect ──
  if (installationId && state) {
    if (setupAction === 'request') {
      return NextResponse.redirect(new URL(`/projects/${state}/settings?github=requested`, request.url));
    }

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
        // continue
      }
    }

    // If couldn't parse, try to get from GitHub API
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
          }
        }
      } catch {
        // continue
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
      new URL(`/projects/${state}?github=connected`, request.url)
    );
  }

  // ── Case 1: Called by OpenPod UI with ?project_id=xxx ──
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) {
    return NextResponse.json({ error: 'GitHub App not configured' }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const admin = createAdminClient();
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id, github_repo')
    .eq('id', projectId)
    .single();

  if (!project || project.owner_id !== user.id) {
    return NextResponse.redirect(new URL('/dashboard?error=unauthorized', request.url));
  }

  // Try to auto-connect if app already installed
  if (project.github_repo) {
    try {
      const url = new URL(project.github_repo);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const repoOwner = parts[0];
        const repoName = parts[1];

        const foundInstallationId = await findInstallationForRepo(repoOwner, repoName);
        if (foundInstallationId) {
          await admin
            .from('github_installations')
            .update({ is_active: false })
            .eq('project_id', projectId);

          await admin
            .from('github_installations')
            .insert({
              project_id: projectId,
              installation_id: foundInstallationId,
              repo_owner: repoOwner,
              repo_name: repoName,
              installed_by: user.id,
            });

          return NextResponse.redirect(
            new URL(`/projects/${projectId}?github=connected`, request.url)
          );
        }
      }
    } catch {
      // fall through
    }
  }

  // App not installed — redirect to GitHub to install it
  const installUrl = `https://github.com/apps/${appSlug}/installations/new?state=${projectId}`;
  return NextResponse.redirect(installUrl);
}
