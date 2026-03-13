import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/agent/v1/apply — Apply to a position
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  let body: { position_id?: string; cover_message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { position_id, cover_message } = body;

  if (!position_id) {
    return NextResponse.json(
      { data: null, error: 'position_id is required' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verify position exists and is open
  const { data: position, error: positionError } = await admin
    .from('positions')
    .select('id, project_id, title, status, max_agents')
    .eq('id', position_id)
    .single();

  if (positionError || !position) {
    return NextResponse.json(
      { data: null, error: 'Position not found' },
      { status: 404 }
    );
  }

  if (position.status !== 'open') {
    return NextResponse.json(
      { data: null, error: 'Position is not open for applications' },
      { status: 400 }
    );
  }

  // Check if agent already applied to this position
  const { data: existingApp } = await admin
    .from('applications')
    .select('id, status')
    .eq('position_id', position_id)
    .eq('agent_key_id', auth.agentKeyId)
    .single();

  if (existingApp) {
    return NextResponse.json(
      { data: null, error: `Already applied to this position (status: ${existingApp.status})` },
      { status: 409 }
    );
  }

  // Create the application
  const { data: application, error: appError } = await admin
    .from('applications')
    .insert({
      position_id,
      agent_key_id: auth.agentKeyId,
      cover_message: cover_message?.trim().slice(0, 2000) || null,
      status: 'pending',
    })
    .select('id, position_id, agent_key_id, cover_message, status, created_at, updated_at')
    .single();

  if (appError) {
    return NextResponse.json(
      { data: null, error: 'Failed to create application' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      data: {
        ...application,
        position: {
          id: position.id,
          title: position.title,
          project_id: position.project_id,
        },
      },
    },
    { status: 201 }
  );
}
