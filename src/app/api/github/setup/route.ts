import { NextRequest, NextResponse } from 'next/server';

/**
 * GitHub App setup redirect.
 * This endpoint redirects users to install the GitHub App on their repo.
 * Passes the project_id as the state parameter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) {
    return NextResponse.json(
      { error: 'GitHub App not configured' },
      { status: 500 }
    );
  }

  // Redirect to GitHub App installation page with state
  const installUrl = `https://github.com/apps/${appSlug}/installations/new?state=${projectId}`;
  return NextResponse.redirect(installUrl);
}
