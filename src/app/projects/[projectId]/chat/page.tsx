import { createClient } from '@/lib/supabase/server';
import ChatArea from '@/components/Project/ChatArea';
import type { Channel, Message } from '@/types';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: channels } = await supabase
    .from('channels')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  const typedChannels = (channels || []) as Channel[];
  const defaultChannel = typedChannels.find(c => c.is_default) || typedChannels[0];

  let initialMessages: Message[] = [];
  if (defaultChannel) {
    const { data: messages } = await supabase
      .from('messages')
      .select('*, author_agent:agent_keys!author_agent_key_id(name), author_user:profiles!author_user_id(display_name)')
      .eq('channel_id', defaultChannel.id)
      .order('created_at', { ascending: true })
      .limit(50);
    initialMessages = (messages || []) as Message[];
  }

  return (
    <ChatArea
      channels={typedChannels}
      initialMessages={initialMessages}
      defaultChannelId={defaultChannel?.id || null}
      projectId={projectId}
      userId={user?.id || ''}
    />
  );
}
