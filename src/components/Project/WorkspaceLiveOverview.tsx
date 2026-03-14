'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Badge from '@/components/UI/Badge';
import QuickChatInput from '@/components/Project/QuickChatInput';
import OrgChartInteractive from '@/components/Project/OrgChartInteractive';
import AdminSimulationButton from '@/components/Project/AdminSimulationButton';
import LiveSimulationPanel from '@/components/Project/LiveSimulationPanel';
import { Calendar, Github, MessageSquare, Ticket, Brain, CheckCircle, X } from 'lucide-react';
import { formatCents, TICKET_STATUS_LABELS } from '@/lib/constants';
import Link from 'next/link';
import type { Project, Position, Message, Ticket as TicketType, KnowledgeEntry } from '@/types';

interface LiveChat { id: string; agent: string; content: string }
interface LiveTicket { id: string; title: string; priority: string; number: number }
interface LiveKnowledge { id: string; title: string; category: string }
interface LivePosition { id: string; title: string; roleLevel: string }

interface Props {
  projectId: string;
  project: Project;
  positions: Position[];
  isOwner: boolean;
  initialMessages: Message[];
  initialTickets: TicketType[];
  initialKnowledge: KnowledgeEntry[];
  channelId: string | null;
  userId: string | null;
  isAdmin?: boolean;
  hasSimulated?: boolean;
  hasGitHub?: boolean;
}

export default function WorkspaceLiveOverview({
  projectId, project, positions, isOwner,
  initialMessages, initialTickets, initialKnowledge,
  channelId, userId, isAdmin, hasSimulated, hasGitHub,
}: Props) {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);
  const [realtimeTickets, setRealtimeTickets] = useState<TicketType[]>([]);
  const [liveChats, setLiveChats] = useState<LiveChat[]>([]);
  const [liveTickets, setLiveTickets] = useState<LiveTicket[]>([]);
  const [liveKnowledge, setLiveKnowledge] = useState<LiveKnowledge[]>([]);
  const [livePositions, setLivePositions] = useState<LivePosition[]>([]);
  const [showGithubBanner, setShowGithubBanner] = useState(searchParams.get('github') === 'connected');
  const chatRef = useRef<HTMLDivElement>(null);
  const ticketCounter = useRef(0);

  // Auto-scroll chat when new live messages appear
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [liveChats, realtimeMessages]);

  // ── Supabase real-time: messages for this project's channels ──
  const seenMsgIds = useRef(new Set<string>());

  useEffect(() => {
    if (!channelId) return;

    const chan = supabase
      .channel(`overview-msgs-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const raw = payload.new as Message;
          if (seenMsgIds.current.has(raw.id)) return;
          seenMsgIds.current.add(raw.id);

          // Fetch with author joins
          const { data } = await supabase
            .from('messages')
            .select('*, author_agent:agent_keys!author_agent_key_id(name), author_user:profiles!author_user_id(display_name)')
            .eq('id', raw.id)
            .single();
          if (data) {
            setRealtimeMessages(prev => [...prev, data as Message]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(chan); };
  }, [channelId, projectId, supabase]);

  // ── Supabase real-time: tickets for this project ──
  useEffect(() => {
    const chan = supabase
      .channel(`overview-tickets-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `project_id=eq.${projectId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const raw = payload.new as TicketType;
            setRealtimeTickets(prev => {
              if (prev.some(t => t.id === raw.id)) return prev;
              return [...prev, raw];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TicketType;
            // Always upsert — handles tickets from initialTickets AND realtimeTickets
            setRealtimeTickets(prev => {
              const filtered = prev.filter(t => t.id !== updated.id);
              return [...filtered, updated];
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(chan); };
  }, [projectId, supabase]);


  // Merge server positions with live-created positions for org chart
  const allPositions = useMemo<Position[]>(() => [
    ...positions,
    ...livePositions.map((lp, i) => ({
      id: lp.id,
      project_id: projectId,
      title: lp.title,
      description: null,
      required_capabilities: null,
      pay_rate_cents: null,
      pay_type: 'fixed' as const,
      max_agents: 1,
      status: 'open' as const,
      role_level: lp.roleLevel as Position['role_level'],
      reports_to: null,
      sort_order: positions.length + i,
      system_prompt: null,
      payment_status: 'unfunded' as const,
      amount_earned_cents: 0,
      created_at: '',
    })),
  ], [positions, livePositions, projectId]);

  // Merge initial tickets with real-time updates (real-time overrides initial for same id)
  const mergedTickets = useMemo(() => {
    const map = new Map<string, TicketType>();
    for (const t of initialTickets) map.set(t.id, t);
    for (const t of realtimeTickets) map.set(t.id, t);
    return Array.from(map.values());
  }, [initialTickets, realtimeTickets]);

  // Merge initial messages with real-time (deduplicate by id)
  const mergedMessages = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of initialMessages) map.set(m.id, m);
    for (const m of realtimeMessages) map.set(m.id, m);
    return Array.from(map.values()).sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [initialMessages, realtimeMessages]);

  const totalPositions = allPositions.length;
  const openPositions = allPositions.filter(p => p.status === 'open').length;
  const ticketCount = mergedTickets.length + liveTickets.length;
  const hasMessages = mergedMessages.length > 0 || liveChats.length > 0;
  const hasTickets = mergedTickets.length > 0 || liveTickets.length > 0;
  const hasKnowledge = initialKnowledge.length > 0 || liveKnowledge.length > 0;

  return (
    <div className="max-w-6xl space-y-6">
      {/* GitHub Connected Banner */}
      {showGithubBanner && (
        <div className="flex items-center justify-between p-3 rounded-md bg-success/10 border border-success/20">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-sm text-success">GitHub App connected. Agents can now access your repo.</span>
          </div>
          <button onClick={() => setShowGithubBanner(false)} className="text-success/60 hover:text-success cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Admin Simulation — only visible to admin */}
      {isAdmin && (
        <AdminSimulationButton
          projectId={projectId}
          hasSimulated={hasSimulated ?? false}
        />
      )}

      {/* Live AI Simulation — admin only */}
      {isAdmin && (
        <LiveSimulationPanel
          projectId={projectId}
          hasGitHub={hasGitHub ?? false}
        />
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Positions" value={`${totalPositions - openPositions}/${totalPositions} filled`} />
        <StatCard label="Open Roles" value={openPositions.toString()} />
        <StatCard label="Tickets" value={ticketCount > 0 ? ticketCount.toString() : '—'} />
        <StatCard label="Budget" value={project.budget_cents ? formatCents(project.budget_cents) : '—'} />
      </div>

      {/* Vision + GitHub */}
      <section>
        <h2 className="font-display text-xs font-medium text-secondary tracking-widest uppercase mb-3">Vision</h2>
        <div className="card-glow p-4 rounded-md bg-surface border border-[var(--border)]">
          <p className="text-sm whitespace-pre-wrap">{project.description}</p>
          <div className="flex items-center gap-4 mt-3">
            {project.deadline && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(project.deadline).toLocaleDateString()}
              </div>
            )}
            {project.github_repo && (
              <a
                href={project.github_repo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <Github className="h-3.5 w-3.5" />
                {project.github_repo.replace('https://github.com/', '')}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column — 60% */}
        <div className="lg:col-span-3 space-y-6">
          {/* Org Chart */}
          <section>
            <h2 className="font-display text-xs font-medium text-secondary tracking-widest uppercase mb-3">Organization</h2>
            <OrgChartInteractive positions={allPositions} project={project} />
          </section>

          {/* Tickets */}
          <section>
            <SectionHeader title="Tickets" icon={<Ticket className="h-4 w-4" />} href={`/projects/${projectId}/tickets`} />
            <div className="rounded-md bg-surface border border-[var(--border)]">
              {hasTickets ? (
                <div className="divide-y divide-[var(--border)]">
                  {mergedTickets.map((ticket) => (
                    <TicketRow key={ticket.id} title={ticket.title} priority={ticket.priority} status={ticket.status} />
                  ))}
                  {liveTickets.map((ticket) => (
                    <TicketRow key={ticket.id} title={ticket.title} priority={ticket.priority} status="todo" live />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted px-4 py-6 text-center">No tickets yet. Once a PM agent is hired, they&apos;ll create and assign tasks.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right column — 40% */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chat Feed */}
          <section>
            <SectionHeader title="Chat" icon={<MessageSquare className="h-4 w-4" />} href={`/projects/${projectId}/chat`} />
            <div className="rounded-md bg-surface border border-[var(--border)] p-4">
              {hasMessages ? (
                <div ref={chatRef} className="space-y-3 max-h-64 overflow-y-auto">
                  {mergedMessages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  {liveChats.map((msg) => (
                    <LiveChatBubble key={msg.id} agent={msg.agent} content={msg.content} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted text-center py-4">No messages yet. Post a message to your team below.</p>
              )}
              {channelId && userId && (
                <QuickChatInput
                  channelId={channelId}
                  projectId={projectId}
                  userId={userId}
                  onMessageSent={(msg) => setLiveChats(prev => [...prev, {
                    id: `user-${Date.now()}`,
                    agent: msg.author,
                    content: msg.content,
                  }])}
                />
              )}
              {!channelId && (
                <p className="text-xs text-muted text-center py-2 mt-2 border-t border-[var(--border)]">Chat channel not created yet.</p>
              )}
            </div>
          </section>

          {/* Memory Highlights */}
          <section>
            <SectionHeader title="Memory" icon={<Brain className="h-4 w-4" />} href={`/projects/${projectId}/memory`} />
            <div className="space-y-2">
              {hasKnowledge ? (
                <>
                  {initialKnowledge.map((entry) => (
                    <KnowledgeCard key={entry.id} title={entry.title} category={entry.category} />
                  ))}
                  {liveKnowledge.map((entry) => (
                    <KnowledgeCard key={entry.id} title={entry.title} category={entry.category} live />
                  ))}
                </>
              ) : (
                <div className="p-4 rounded-md bg-surface border border-[var(--border)]">
                  <p className="text-xs text-muted text-center">No knowledge entries yet. Agents will document decisions, patterns, and architecture here.</p>
                </div>
              )}
            </div>
          </section>

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <section>
              <h2 className="font-display text-xs font-medium text-secondary tracking-widest uppercase mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded text-xs bg-surface-light text-muted border border-[var(--border)]">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-glow p-3 rounded-md bg-surface border border-[var(--border)]">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="font-display text-sm font-medium">{value}</p>
    </div>
  );
}

function SectionHeader({ title, icon, href }: { title: string; icon: React.ReactNode; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display text-xs font-medium text-secondary tracking-widest uppercase flex items-center gap-2">
        {icon} {title}
      </h2>
      <Link href={href} className="text-xs text-accent hover:underline">
        View All
      </Link>
    </div>
  );
}

function TicketRow({ title, priority, status, live }: { title: string; priority: string; status: string; live?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${live ? 'bg-accent/5' : ''}`}>
      <Badge variant={
        priority === 'urgent' ? 'error' :
        priority === 'high' ? 'warning' :
        priority === 'medium' ? 'accent' : 'default'
      }>
        {priority}
      </Badge>
      <span className="text-sm flex-1 truncate">{title}</span>
      <Badge variant={
        status === 'done' ? 'success' :
        status === 'in_progress' || status === 'in_review' ? 'accent' : 'default'
      }>
        {TICKET_STATUS_LABELS[status as keyof typeof TICKET_STATUS_LABELS] || status}
      </Badge>
    </div>
  );
}

function stripSim(name: string) {
  return name.replace(/^SIM-/, '');
}

function ChatMessage({ message }: { message: Message }) {
  const isAgent = !!message.author_agent_key_id;
  const raw = message.author_user?.display_name || message.author_agent?.name || 'Unknown';
  const authorName = stripSim(raw);

  return (
    <div className="flex gap-2">
      <div className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 text-xs font-medium ${
        isAgent ? 'bg-secondary/15 text-secondary' : 'bg-accent/15 text-accent'
      }`}>
        {authorName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{authorName}</span>
          {isAgent && <span className="text-xs text-secondary">bot</span>}
        </div>
        <p className="text-sm text-muted">{message.content}</p>
      </div>
    </div>
  );
}

function LiveChatBubble({ agent, content }: { agent: string; content: string }) {
  return (
    <div className="flex gap-2">
      <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 text-xs font-medium bg-secondary/15 text-secondary">
        {agent.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{agent}</span>
          <span className="text-xs text-secondary">bot</span>
        </div>
        <p className="text-sm text-muted">{content}</p>
      </div>
    </div>
  );
}

function KnowledgeCard({ title, category, live }: { title: string; category: string; live?: boolean }) {
  return (
    <div className={`p-3 rounded-md bg-surface border border-[var(--border)] ${live ? 'border-accent/20' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <Badge>{category}</Badge>
      </div>
      <p className="text-sm truncate">{title}</p>
    </div>
  );
}
