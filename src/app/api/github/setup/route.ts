import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findInstallationForRepo } from '@/lib/github';

/**
 * GitHub App setup — connects a project to GitHub.
 *
 * Flow:
 * 1. Check if project has a github_repo URL
 * 2. Check if the GitHub App is already installed on that repo
 * 3. If yes → link the installation to the project directly (no redirect)
 * 4. If no → redirect to GitHub App install page
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) {
    return NextResponse.json({ error: 'GitHub App not configured' }, { status: 500 });
  }

  // Verify user is authenticated and owns the project
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

  // If project has a github_repo URL, try to find an existing installation
  if (project.github_repo) {
    try {
      const url = new URL(project.github_repo);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const repoOwner = parts[0];
        const repoName = parts[1];

        const installationId = await findInstallationForRepo(repoOwner, repoName);
        if (installationId) {
          // App already installed on this repo — link it directly
          await admin
            .from('github_installations')
            .update({ is_active: false })
            .eq('project_id', projectId);

          await admin
            .from('github_installations')
            .insert({
              project_id: projectId,
              installation_id: installationId,
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
      // If parsing fails, fall through to GitHub install redirect
    }
  }

  // App not installed on the repo — redirect to GitHub to install it
  const installUrl = `https://github.com/apps/${appSlug}/installations/new?state=${projectId}`;
  return NextResponse.redirect(installUrl);
}
