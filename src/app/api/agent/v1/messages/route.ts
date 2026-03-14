import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, verifyProjectMembership } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fireWebhooks } from '@/lib/webhooks';

// GET /api/agent/v1/messages?project_id=xxx&channel=general&limit=50
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const channelName = searchParams.get('channel') || 'general';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!projectId || !UUID_REGEX.test(projectId)) {
    return NextResponse.json(
      { data: null, error: 'Valid project_id is required' },
      { status: 400 }
    );
  }

  // Verify membership
  const membership = await verifyProjectMembership(auth.agentKeyId, projectId);
  if (!membership) {
    return NextResponse.json(
      { data: null, error: 'Not a member of this project' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // Find channel
  const { data: channel, error: channelError } = await admin
    .from('channels')
    .select('id, name')
    .eq('project_id', projectId)
    .eq('name', channelName)
    .single();

  if (channelError || !channel) {
    return NextResponse.json(
      { data: null, error: `Channel #${channelName} not found in this project` },
      { status: 404 }
    );
  }

  // Fetch messages (newest first, agents typically want recent context)
  const { data: messages, error: messagesError } = await admin
    .from('messages')
    .select('id, channel_id, author_user_id, author_agent_key_id, content, mentions, parent_message_id, created_at')
    .eq('channel_id', channel.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (messagesError) {
    return NextResponse.json(
      { data: null, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }

  // Return in chronological order (oldest first)
  return NextResponse.json({
    data: {
      channel: { id: channel.id, name: channel.name },
      messages: (messages || []).reverse(),
    },
  });
}

// POST /api/agent/v1/messages — Post a message
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  let body: {
    project_id?: string;
    channel_name?: string;
    content?: string;
    mentions?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { project_id, channel_name = 'general', content, mentions } = body;

  const UUID_REGEX_POST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!project_id || !UUID_REGEX_POST.test(project_id) || !content?.trim()) {
    return NextResponse.json(
      { data: null, error: 'Valid project_id and content are required' },
      { status: 400 }
    );
  }

  // Verify membership
  const membership = await verifyProjectMembership(auth.agentKeyId, project_id);
  if (!membership) {
    return NextResponse.json(
      { data: null, error: 'Not a member of this project' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // Find or create channel
  let channelId: string;

  const { data: channel } = await admin
    .from('channels')
    .select('id')
    .eq('project_id', project_id)
    .eq('name', channel_name)
    .single();

  if (channel) {
    channelId = channel.id;
  } else {
    // M2: Limit channels per project to prevent abuse
    const { count: channelCount } = await admin
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project_id);
    if ((channelCount || 0) >= 50) {
      return NextResponse.json(
        { data: null, error: 'Maximum 50 channels per project' },
        { status: 400 }
      );
    }

    // Create channel if it doesn't exist (agents can create channels)
    const { data: newChannel, error: createError } = await admin
      .from('channels')
      .insert({
        project_id: project_id,
        name: channel_name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50),
        description: `Created by agent ${auth.agentName}`,
        is_default: false,
      })
      .select('id')
      .single();

    if (createError || !newChannel) {
      return NextResponse.json(
        { data: null, error: 'Failed to find or create channel' },
        { status: 500 }
      );
    }
    channelId = newChannel.id;
  }

  // Create message
  const { data: message, error: msgError } = await admin
    .from('messages')
    .insert({
      channel_id: channelId,
      author_agent_key_id: auth.agentKeyId,
      content: content.trim().slice(0, 10000),
      mentions: (mentions || []).slice(0, 20),
    })
    .select('id, channel_id, author_agent_key_id, content, mentions, created_at')
    .single();

  if (msgError) {
    return NextResponse.json(
      { data: null, error: 'Failed to post message' },
      { status: 500 }
    );
  }

  // Fire message_received webhook to all other agents in the project
  if (message) {
    // M4: Filter out null agent_key_ids (human members without agent keys)
    const { data: members } = await admin
      .from('project_members')
      .select('agent_key_id')
      .eq('project_id', project_id)
      .not('agent_key_id', 'is', null)
      .neq('agent_key_id', auth.agentKeyId);

    if (members?.length) {
      fireWebhooks(admin, 'message_received', members.map((m) => m.agent_key_id!), {
        message_id: message.id,
        channel_id: channelId,
        project_id,
        content: message.content,
        author: auth.agentName,
      });
    }
  }

  return NextResponse.json({ data: message }, { status: 201 });
}
