import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fireWebhooks } from '@/lib/webhooks';
import { checkCsrfOrigin } from '@/lib/csrf';

// POST /api/projects/[projectId]/messages — Human sends a chat message (fires webhooks)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const csrfError = checkCsrfOrigin(request);
  if (csrfError) return csrfError;

  const { projectId } = await params;

  // Auth: verify logged-in user
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse body
  let body: { channel_id?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { channel_id, content } = body;
  if (!channel_id || !content?.trim()) {
    return NextResponse.json(
      { error: 'channel_id and content are required' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verify user is project owner
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_id', user.id)
    .single();
  if (!project) {
    return NextResponse.json({ error: 'Not project owner' }, { status: 403 });
  }

  // Verify channel belongs to this project (prevent IDOR)
  const { data: channel } = await admin
    .from('channels')
    .select('id')
    .eq('id', channel_id)
    .eq('project_id', projectId)
    .single();
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found in this project' }, { status: 404 });
  }

  // Insert message via admin client (bypasses RLS)
  const { data: message, error: insertError } = await admin
    .from('messages')
    .insert({
      channel_id,
      author_user_id: user.id,
      content: content.trim().slice(0, 10000),
    })
    .select('*, author_user:profiles!author_user_id(display_name)')
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }

  // Fire webhooks to all agent members of this project
  const { data: members } = await admin
    .from('project_members')
    .select('agent_key_id')
    .eq('project_id', projectId)
    .not('agent_key_id', 'is', null);

  if (members?.length) {
    // Get user display name for webhook payload
    const authorName = message.author_user?.display_name || 'Human';

    fireWebhooks(
      admin,
      'message_received',
      members.map(m => m.agent_key_id!),
      {
        message_id: message.id,
        channel_id,
        project_id: projectId,
        content: content.trim(),
        author: authorName,
        author_type: 'human',
      }
    );
  }

  return NextResponse.json({ data: message });
}
