import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findInstallationForRepo } from '@/lib/github';
import { checkCsrfOrigin } from '@/lib/csrf';

/**
 * POST /api/github/connect
 * Body: { project_id: string }
 *
 * Attempts to connect a project to the GitHub App without any redirects.
 * 1. Reads the project's github_repo URL
 * 2. Checks if the GitHub App is installed on that repo
 * 3. If yes → creates github_installations record, returns { connected: true }
 * 4. If no → returns { connected: false, install_url: "..." }
 */
export async function POST(request: NextRequest) {
  const csrfError = checkCsrfOrigin(request);
  if (csrfError) return csrfError;

  const body = await request.json();
  const { project_id } = body;

  if (!project_id) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(project_id)) {
    return NextResponse.json({ error: 'Invalid project_id format' }, { status: 400 });
  }

  // Verify user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id, github_repo')
    .eq('id', project_id)
    .single();

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Project not found or not owned by you' }, { status: 403 });
  }

  if (!project.github_repo) {
    return NextResponse.json({ error: 'No GitHub repository URL set for this project' }, { status: 400 });
  }

  // Parse repo owner/name from URL
  let repoOwner = '';
  let repoName = '';
  try {
    const url = new URL(project.github_repo);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      repoOwner = parts[0];
      repoName = parts[1];
    }
  } catch {
    return NextResponse.json({ error: 'Invalid GitHub repository URL' }, { status: 400 });
  }

  if (!repoOwner || !repoName) {
    return NextResponse.json({ error: 'Could not parse owner/repo from URL' }, { status: 400 });
  }

  // Check if GitHub App is already installed on this repo
  const installationId = await findInstallationForRepo(repoOwner, repoName);

  if (!installationId) {
    const appSlug = process.env.GITHUB_APP_SLUG || 'openpod-work';
    return NextResponse.json({
      connected: false,
      message: `GitHub App is not installed on ${repoOwner}/${repoName}. Install it first, then try again.`,
      install_url: `https://github.com/apps/${appSlug}/installations/new`,
    });
  }

  // App is installed — link it to the project
  await admin
    .from('github_installations')
    .update({ is_active: false })
    .eq('project_id', project_id);

  const { error: insertError } = await admin
    .from('github_installations')
    .insert({
      project_id,
      installation_id: installationId,
      repo_owner: repoOwner,
      repo_name: repoName,
      installed_by: user.id,
    });

  if (insertError) {
    return NextResponse.json({ error: 'Failed to save GitHub installation' }, { status: 500 });
  }

  return NextResponse.json({
    connected: true,
    repo: `${repoOwner}/${repoName}`,
    installation_id: installationId,
  });
}
