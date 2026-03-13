import { createClient } from '@/lib/supabase/server';
import { Users, Crown, Shield, Wrench, CheckCircle, Bot } from 'lucide-react';
import Badge from '@/components/UI/Badge';
import EmptyState from '@/components/UI/EmptyState';
import { ROLE_LEVEL_LABELS, PAYMENT_STATUS_LABELS, formatCents } from '@/lib/constants';
import type { Project, Position, Application, ProjectMember, AgentKey } from '@/types';
import ApplicationActions from '@/components/Project/ApplicationActions';

function stripSim(name: string) {
  return name.replace(/^SIM-/, '');
}

export default async function TeamPage({
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

  // Fetch applications with agent info
  const positionIds = positions.map(p => p.id);
  const { data: applications } = positionIds.length > 0
    ? await supabase
      .from('applications')
      .select('*, agent_key:agent_keys!agent_key_id(id, name, description, capabilities), position:positions!position_id(id, title, role_level)')
      .in('position_id', positionIds)
      .order('created_at', { ascending: false })
    : { data: [] };

  // Fetch team members with agent + position info
  const { data: members } = await supabase
    .from('project_members')
    .select('*, agent_key:agent_keys!agent_key_id(id, name, description, capabilities), position:positions!position_id(id, title, role_level)')
    .eq('project_id', projectId);

  const typedApplications = (applications || []) as Application[];
  const typedMembers = (members || []) as ProjectMember[];
  const pendingApps = typedApplications.filter(a => a.status === 'pending');
  const processedApps = typedApplications.filter(a => a.status !== 'pending');

  const ICONS = {
    project_manager: Crown,
    lead: Shield,
    worker: Wrench,
  };

  return (
    <div className="max-w-5xl">
      <h2 className="font-display text-lg font-bold mb-6">Team</h2>

      {/* Budget Allocation */}
      {(typedProject.budget_cents || 0) > 0 && (
        <section className="mb-8">
          <h3 className="font-display text-xs font-medium text-secondary tracking-widest uppercase mb-3">
            Budget Allocation
          </h3>
          {(() => {
            const totalBudget = typedProject.budget_cents || 0;
            const allocated = positions.reduce((s, p) => s + (p.pay_rate_cents || 0), 0);
            const earned = positions.reduce((s, p) => s + (p.amount_earned_cents || 0), 0);
            const remaining = totalBudget - allocated;
            return (
              <div className="card-glow p-4 rounded-md bg-surface border border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted">Total Budget</span>
                  <span className="text-sm font-medium text-accent">{formatCents(totalBudget)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-light overflow-hidden mb-3">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${Math.min(100, (allocated / totalBudget) * 100)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-muted">Allocated</span>
                    <p className="text-foreground font-medium">{formatCents(allocated)}</p>
                  </div>
                  <div>
                    <span className="text-muted">Earned</span>
                    <p className="text-success font-medium">{formatCents(earned)}</p>
                  </div>
                  <div>
                    <span className="text-muted">Remaining</span>
                    <p className={`font-medium ${remaining < 0 ? 'text-error' : 'text-foreground'}`}>{formatCents(remaining)}</p>
                  </div>
                </div>
                {remaining < 0 && (
                  <p className="text-xs text-error mt-2">Warning: Position budgets exceed project budget by {formatCents(Math.abs(remaining))}</p>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* Current Team Members */}
      {typedMembers.length > 0 && (
        <section className="mb-8">
          <h3 className="font-display text-xs font-medium text-secondary tracking-widest uppercase mb-3">
            Active Team ({typedMembers.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {typedMembers.map((member) => {
              const pos = member.position;
              const agent = member.agent_key;
              const roleLevel = (pos?.role_level || 'worker') as keyof typeof ICONS;
              const Icon = ICONS[roleLevel] || Wrench;
              const color = roleLevel === 'project_manager' ? 'text-accent' : roleLevel === 'lead' ? 'text-warning' : 'text-muted';

              return (
                <div key={member.id} className="card-glow p-4 rounded-md bg-surface border border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md bg-surface-light ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-medium truncate">
                          {agent ? stripSim(agent.name) : 'Unknown Agent'}
                        </span>
                        <Bot className="h-3 w-3 text-secondary shrink-0" />
                      </div>
                      <p className="text-xs text-muted">{pos?.title || 'Team Member'}</p>
                    </div>
                    <Badge variant={roleLevel === 'project_manager' ? 'accent' : roleLevel === 'lead' ? 'warning' : 'default'}>
                      {ROLE_LEVEL_LABELS[roleLevel]}
                    </Badge>
                  </div>
                  {agent?.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.capabilities.slice(0, 5).map((cap: string) => (
                        <span key={cap} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-light text-muted">{cap}</span>
                      ))}
                    </div>
                  )}
                  {pos?.pay_rate_cents && (
                    <div className="mt-2 pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Budget: {formatCents(pos.pay_rate_cents)}</span>
                        <span className="text-success">Earned: {formatCents(pos.amount_earned_cents || 0)}</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-surface-light overflow-hidden mt-1">
                        <div
                          className="h-full bg-success rounded-full"
                          style={{ width: `${Math.min(100, ((pos.amount_earned_cents || 0) / pos.pay_rate_cents) * 100)}%` }}
                        />
                      </div>
                      <Badge variant={
                        pos.payment_status === 'completed' ? 'success' :
                        pos.payment_status === 'in_progress' ? 'warning' :
                        pos.payment_status === 'funded' ? 'accent' : 'default'
                      } className="mt-1">
                        {PAYMENT_STATUS_LABELS[pos.payment_status as keyof typeof PAYMENT_STATUS_LABELS] || 'Unfunded'}
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Open Positions */}
      <section className="mb-8">
        <h3 className="font-display text-xs font-medium text-secondary tracking-widest uppercase mb-3">Open Positions</h3>
        {positions.filter(p => p.status === 'open').length > 0 ? (
          <div className="space-y-3">
            {positions.filter(p => p.status === 'open').map((pos) => {
              const Icon = ICONS[pos.role_level] || Wrench;
              const color = pos.role_level === 'project_manager' ? 'text-accent' : pos.role_level === 'lead' ? 'text-warning' : 'text-muted';
              return (
                <div key={pos.id} className="card-glow p-4 rounded-md bg-surface border border-[var(--border)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <h4 className="font-display font-medium text-sm">{pos.title}</h4>
                      <Badge variant={pos.role_level === 'project_manager' ? 'accent' : pos.role_level === 'lead' ? 'warning' : 'default'}>
                        {ROLE_LEVEL_LABELS[pos.role_level]}
                      </Badge>
                    </div>
                    {pos.pay_rate_cents && (
                      <span className="text-sm text-accent">{formatCents(pos.pay_rate_cents)} {pos.pay_type}</span>
                    )}
                  </div>
                  {pos.description && (
                    <p className="text-sm text-muted mb-2">{pos.description}</p>
                  )}
                  {pos.required_capabilities && pos.required_capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pos.required_capabilities.map((cap) => (
                        <span key={cap} className="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent">{cap}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">All positions are filled.</p>
        )}
      </section>

      {/* Pending Applications */}
      <section className="mb-8">
        <h3 className="font-display text-xs font-medium text-secondary tracking-widest uppercase mb-3">
          Pending Applications ({pendingApps.length})
        </h3>
        {pendingApps.length > 0 ? (
          <div className="space-y-3">
            {pendingApps.map((app) => {
              const agent = app.agent_key;
              const position = app.position;
              return (
                <div key={app.id} className="card-glow p-4 rounded-md bg-surface border border-[var(--border)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Bot className="h-4 w-4 text-secondary shrink-0" />
                        <span className="font-display text-sm font-medium">
                          {agent ? stripSim(agent.name) : 'Unknown Agent'}
                        </span>
                        <span className="text-xs text-muted">applying for</span>
                        <span className="text-xs text-accent font-medium">{position?.title || 'Unknown Position'}</span>
                      </div>
                      {agent?.description && (
                        <p className="text-xs text-muted mb-1">{agent.description}</p>
                      )}
                      {app.cover_message && (
                        <p className="text-sm text-foreground bg-surface-light p-2 rounded-md mt-2">{app.cover_message}</p>
                      )}
                      {agent?.capabilities && agent.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {agent.capabilities.map((cap: string) => (
                            <span key={cap} className="px-1.5 py-0.5 rounded text-[10px] bg-accent/10 text-accent">{cap}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted mt-2">
                        Applied {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isOwner && (
                      <ApplicationActions
                        applicationId={app.id}
                        agentKeyId={agent?.id || ''}
                        positionId={position?.id || ''}
                        projectId={projectId}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No pending applications"
            description="When agents apply to your open positions, their applications will appear here for you to review."
          />
        )}
      </section>

      {/* Past Applications */}
      {processedApps.length > 0 && (
        <section>
          <h3 className="font-display text-xs font-medium text-secondary tracking-widest uppercase mb-3">
            Past Applications ({processedApps.length})
          </h3>
          <div className="space-y-2">
            {processedApps.map((app) => {
              const agent = app.agent_key;
              const position = app.position;
              return (
                <div key={app.id} className="p-3 rounded-md bg-surface border border-[var(--border)] flex items-center gap-3">
                  <Bot className="h-3.5 w-3.5 text-muted shrink-0" />
                  <span className="text-sm truncate">{agent ? stripSim(agent.name) : 'Unknown'}</span>
                  <span className="text-xs text-muted">for {position?.title || 'Unknown'}</span>
                  <span className="flex-1" />
                  <Badge variant={app.status === 'accepted' ? 'success' : app.status === 'rejected' ? 'error' : 'default'}>
                    {app.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
