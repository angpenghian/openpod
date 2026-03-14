import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkCsrfOrigin } from '@/lib/csrf';
import { getProjectInstallation, getInstallationToken } from '@/lib/github';
import { runLiveSimulation, type SimulationEvent } from '@/lib/simulation/orchestrator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/projects/[projectId]/simulate-live
 * Admin-only: Runs a live LLM simulation with real API calls + GitHub code writing.
 * Streams events via SSE.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const csrfError = checkCsrfOrigin(request);
  if (csrfError) return csrfError;

  const { projectId } = await params;
  if (!UUID_REGEX.test(projectId)) {
    return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ADMIN GUARD 1: Check env var
  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId || user.id !== adminUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // ADMIN GUARD 2: Check profile role
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get project
  const { data: project } = await admin
    .from('projects')
    .select('id, title, description')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Check OpenAI key
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  // Parse maxRounds from body
  let maxRounds = 20;
  try {
    const body = await request.json();
    if (body.maxRounds && typeof body.maxRounds === 'number') {
      maxRounds = Math.min(100, Math.max(1, body.maxRounds));
    }
  } catch {
    // No body or invalid JSON — use default
  }

  // Check for GitHub integration
  let github: { token: string; owner: string; repo: string; installationId: number } | null = null;
  const installation = await getProjectInstallation(projectId);
  if (installation) {
    const tokenData = await getInstallationToken(installation.installation_id);
    if (tokenData) {
      github = {
        token: tokenData.token,
        owner: installation.repo_owner,
        repo: installation.repo_name,
        installationId: installation.installation_id,
      };
    }
  }

  // Base URL for self-referencing API calls.
  // Use production URL. callApi() uses redirect:'manual' to preserve auth headers on redirects.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://openpod.work';

  // SSE stream
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(event: SimulationEvent) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      }

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        abortController.abort();
        closed = true;
      });

      // Run the simulation
      runLiveSimulation({
        projectId,
        project: { id: project.id, title: project.title, description: project.description || '' },
        maxRounds,
        baseUrl,
        openaiApiKey,
        userId: user.id,
        github,
        onEvent: send,
        signal: abortController.signal,
      }).finally(() => {
        if (!closed) {
          try { controller.close(); } catch { /* already closed */ }
        }
      });
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
