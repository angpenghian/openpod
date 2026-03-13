import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findInstallationForRepo, generateAppJWT } from '@/lib/github';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GitHub App setup — handles THREE cases:
 *
 * Case 1: Called by OpenPod UI with ?project_id=xxx
 *   → Auto-connect if app installed, else redirect to GitHub
 *
 * Case 2: Called by GitHub's post-install redirect with ?installation_id=xxx&state=xxx
 *   → Store the installation linked to the project
 *
 * Case 3: Called by GitHub's post-install redirect with ?installation_id=xxx (NO state)
 *   → User installed from GitHub directly, auto-close tab
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const installationId = searchParams.get('installation_id');
  const state = searchParams.get('state'); // project_id passed as state from GitHub
  const setupAction = searchParams.get('setup_action');

  // ── Case 2: GitHub's post-install redirect WITH project context ──
  if (installationId && state) {
    // Validate state is a UUID (prevents open redirect / injection)
    if (!UUID_REGEX.test(state)) {
      return NextResponse.redirect(new URL('/dashboard?error=invalid_state', request.url));
    }

    // Validate installationId is a positive integer
    const installId = parseInt(installationId, 10);
    if (isNaN(installId) || installId <= 0) {
      return NextResponse.redirect(new URL('/dashboard?error=invalid_installation', request.url));
    }

    // Auth check FIRST — before any redirect (fixes auth bypass on setupAction=request)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login?error=unauthenticated', request.url));
    }

    // Now handle setupAction=request (AFTER auth check)
    if (setupAction === 'request') {
      return NextResponse.redirect(new URL(`/projects/${state}/settings?github=requested`, request.url));
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

    // If couldn't parse, fetch from GitHub API WITH JWT auth (fixes unauthenticated API call)
    if (!repoOwner || !repoName) {
      try {
        const jwt = generateAppJWT();
        const res = await fetch(`https://api.github.com/app/installations/${installId}`, {
          headers: {
            Authorization: `Bearer ${jwt}`,
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

    // Deactivate any existing installation for this project, then insert new one
    await admin
      .from('github_installations')
      .update({ is_active: false })
      .eq('project_id', state);

    const { error: insertError } = await admin
      .from('github_installations')
      .insert({
        project_id: state,
        installation_id: installId,
        repo_owner: repoOwner,
        repo_name: repoName,
        installed_by: user.id,
      });

    if (insertError) {
      return NextResponse.redirect(new URL(`/projects/${state}/settings?github=error`, request.url));
    }

    return NextResponse.redirect(
      new URL(`/projects/${state}?github=connected`, request.url)
    );
  }

  // ── Case 3: GitHub redirect WITHOUT project context (installed from GitHub directly) ──
  if (installationId && !state) {
    // Handle setup_action=request in Case 3 too
    const message = setupAction === 'request'
      ? 'Access requested! Your org admin will need to approve the installation.'
      : 'GitHub App installed successfully!';

    return new NextResponse(
      `<!DOCTYPE html>
<html><head><title>OpenPod — GitHub App</title></head>
<body style="background:#0d1117;color:#e6edf3;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<p style="font-size:18px">${message}</p>
<p style="color:#8b949e">This tab will close automatically...</p>
<script>window.close();setTimeout(()=>{document.getElementById('f').style.display='block'},500)</script>
<p id="f" style="display:none;margin-top:16px"><a href="/dashboard" style="color:#7c6aef">Return to OpenPod</a></p>
</div>
</body></html>`,
      {
        headers: {
          'Content-Type': 'text/html',
          'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'",
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }

  // ── Case 1: Called by OpenPod UI with ?project_id=xxx ──
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  // Validate projectId is a UUID
  if (!UUID_REGEX.test(projectId)) {
    return NextResponse.json({ error: 'Invalid project_id format' }, { status: 400 });
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
