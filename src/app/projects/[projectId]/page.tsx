import { createClient } from '@/lib/supabase/server';
import WorkspaceLiveOverview from '@/components/Project/WorkspaceLiveOverview';
import type { Project, Position, Message, Ticket as TicketType, KnowledgeEntry } from '@/types';

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from('projects')
    .select('*, positions(*)')
    .eq('id', projectId)
    .single();

  if (!project) return null;

  const typedProject = project as Project & { positions: Position[] };
  const positions = typedProject.positions || [];
  const isOwner = user?.id === typedProject.owner_id;

  // Check if simulation already ran
  let hasSimulated = false;
  if (isOwner && user) {
    const { data: simAgents } = await supabase
      .from('agent_keys')
      .select('id')
      .like('name', 'SIM-%')
      .eq('owner_id', user.id)
      .limit(1);
    hasSimulated = (simAgents?.length ?? 0) > 0;
  }

  // Fetch #general channel + recent messages
  let channelId: string | null = null;
  let recentMessages: Message[] = [];
  try {
    const { data: channel } = await supabase
      .from('channels')
      .select('id')
      .eq('project_id', projectId)
      .eq('is_default', true)
      .single();

    if (channel) {
      channelId = channel.id;
      const { data: messages } = await supabase
        .from('messages')
        .select('*, author_agent:agent_keys!author_agent_key_id(name), author_user:profiles!author_user_id(display_name)')
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: false })
        .limit(5);
      recentMessages = ((messages || []) as unknown as Message[]).reverse();
    }
  } catch {
    // channels/messages tables may not exist
  }

  // Fetch recent tickets
  let recentTickets: TicketType[] = [];
  try {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'cancelled')
      .order('updated_at', { ascending: false })
      .limit(5);
    recentTickets = (tickets || []) as TicketType[];
  } catch {
    // tickets table may not exist
  }

  // Fetch recent knowledge entries
  let recentKnowledge: KnowledgeEntry[] = [];
  try {
    const { data: knowledge } = await supabase
      .from('knowledge_entries')
      .select('id, title, category, updated_at')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(3);
    recentKnowledge = (knowledge || []) as KnowledgeEntry[];
  } catch {
    // knowledge_entries table may not exist
  }

  return (
    <WorkspaceLiveOverview
      projectId={projectId}
      project={typedProject}
      positions={positions}
      isOwner={isOwner}
      hasSimulated={hasSimulated}
      initialMessages={recentMessages}
      initialTickets={recentTickets}
      initialKnowledge={recentKnowledge}
      channelId={channelId}
      userId={user?.id ?? null}
    />
  );
}
