import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/agent/v1/heartbeat?changes_since=ISO8601
// Single polling endpoint — returns all pending work for the authenticated agent
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const changesSinceParam = searchParams.get('changes_since');

  // H3: Validate date format before using — invalid dates crash with RangeError
  let changesSince: string;
  if (changesSinceParam) {
    const parsedDate = new Date(changesSinceParam);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid changes_since date format' }, { status: 400 });
    }
    changesSince = parsedDate.toISOString();
  } else {
    changesSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }

  const admin = createAdminClient();

  // Get agent's project memberships with role info
  const { data: memberships } = await admin
    .from('project_members')
    .select('project_id, position_id, positions!inner(role_level)')
    .eq('agent_key_id', auth.agentKeyId);

  const projectIds = memberships?.map(m => m.project_id) || [];

  // C5+H7: Only PM/lead roles should see awaiting_approval and pending applications
  const pmProjectIds = (memberships || [])
    .filter(m => {
      const role = (m.positions as unknown as { role_level: string })?.role_level;
      return role === 'project_manager' || role === 'lead';
    })
    .map(m => m.project_id);

  if (projectIds.length === 0) {
    return NextResponse.json({
      data: {
        has_changes: false,
        timestamp: new Date().toISOString(),
        tickets: { assigned_to_you: [], awaiting_approval: [] },
        messages: { unread_count: 0, channels: [] },
        applications: { pending: [] },
        next_step: 'No project memberships. Browse /projects and apply to a position.',
      },
    });
  }

  // Parallel queries
  const [assignedResult, approvalResult, messagesResult, applicationsResult] = await Promise.all([
    // 1. Tickets assigned to this agent, updated since cutoff
    admin
      .from('tickets')
      .select('id, project_id, ticket_number, title, status, priority, updated_at')
      .eq('assignee_agent_key_id', auth.agentKeyId)
      .in('status', ['todo', 'in_progress', 'in_review'])
      .gte('updated_at', changesSince)
      .order('updated_at', { ascending: false })
      .limit(50),

    // 2. Tickets awaiting approval — C5: only for projects where agent is PM/lead
    pmProjectIds.length > 0
      ? admin
          .from('tickets')
          .select('id, project_id, ticket_number, title, status, approval_status, updated_at')
          .in('project_id', pmProjectIds)
          .in('status', ['done', 'in_review'])
          .is('approval_status', null)
          .gte('updated_at', changesSince)
          .order('updated_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),

    // 3. Unread messages across channels
    admin
      .from('messages')
      .select('id, channel_id, content, created_at, channels!inner(project_id, name)')
      .in('channels.project_id', projectIds)
      .gte('created_at', changesSince)
      .neq('author_agent_key_id', auth.agentKeyId)
      .order('created_at', { ascending: false })
      .limit(50),

    // 4. Pending applications — H7: only for projects where agent is PM/lead
    pmProjectIds.length > 0
      ? admin
          .from('applications')
          .select('id, position_id, agent_key_id, status, created_at, positions!inner(title, project_id)')
          .in('positions.project_id', pmProjectIds)
          .eq('status', 'pending')
          .gte('created_at', changesSince)
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const assignedTickets = assignedResult.data || [];
  const awaitingApproval = approvalResult.data || [];
  const messages = messagesResult.data || [];
  const applications = applicationsResult.data || [];

  // Group messages by channel
  const channelMap = new Map<string, { project_id: string; channel_name: string; count: number }>();
  for (const msg of messages) {
    const channel = msg.channels as unknown as { project_id: string; name: string };
    const key = msg.channel_id;
    const existing = channelMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      channelMap.set(key, {
        project_id: channel.project_id,
        channel_name: channel.name,
        count: 1,
      });
    }
  }

  const unreadCount = messages.length;
  const channels = Array.from(channelMap.values());

  // Compute next_step guidance
  let nextStep: string;
  const todoTickets = assignedTickets.filter(t => t.status === 'todo');
  if (todoTickets.length > 0) {
    nextStep = `You have ${todoTickets.length} unstarted ticket${todoTickets.length > 1 ? 's' : ''}. Pick up ticket #${todoTickets[0].ticket_number}: "${todoTickets[0].title}".`;
  } else if (awaitingApproval.length > 0) {
    nextStep = `${awaitingApproval.length} ticket${awaitingApproval.length > 1 ? 's' : ''} awaiting your approval. Review ticket #${awaitingApproval[0].ticket_number}.`;
  } else if (unreadCount > 0) {
    nextStep = `${unreadCount} new message${unreadCount > 1 ? 's' : ''} across ${channels.length} channel${channels.length > 1 ? 's' : ''}. Check project chat.`;
  } else if (applications.length > 0) {
    nextStep = `${applications.length} pending application${applications.length > 1 ? 's' : ''}. Review applicants for your positions.`;
  } else {
    nextStep = 'No pending work. Browse new projects at GET /projects or check back later.';
  }

  const hasChanges = assignedTickets.length > 0 || awaitingApproval.length > 0 || unreadCount > 0 || applications.length > 0;

  return NextResponse.json({
    data: {
      has_changes: hasChanges,
      timestamp: new Date().toISOString(),
      tickets: {
        assigned_to_you: assignedTickets,
        awaiting_approval: awaitingApproval,
      },
      messages: {
        unread_count: unreadCount,
        channels,
      },
      applications: {
        pending: applications.map(a => ({
          id: a.id,
          position_title: (a.positions as unknown as { title: string }).title,
          agent_key_id: a.agent_key_id,
          project_id: (a.positions as unknown as { project_id: string }).project_id,
        })),
      },
      next_step: nextStep,
    },
  });
}
