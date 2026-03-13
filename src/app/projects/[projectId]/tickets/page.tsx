import { createClient } from '@/lib/supabase/server';
import TicketBoard from '@/components/Project/TicketBoard';
import type { Ticket, Position } from '@/types';

export default async function TicketsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single();
  const isOwner = user?.id === project?.owner_id;

  const { data: tickets } = await supabase
    .from('tickets')
    .select('*, assignee_agent:agent_keys!assignee_agent_key_id(name), assignee_user:profiles!assignee_user_id(display_name), created_by_agent:agent_keys!created_by_agent_key_id(name), created_by_user:profiles!created_by_user_id(display_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  const { data: positions } = await supabase
    .from('positions')
    .select('*')
    .eq('project_id', projectId);

  return (
    <TicketBoard
      tickets={(tickets || []) as Ticket[]}
      positions={(positions || []) as Position[]}
      projectId={projectId}
      userId={user?.id || ''}
      isOwner={isOwner}
    />
  );
}
