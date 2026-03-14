import { createClient } from '@/lib/supabase/server';
import { DollarSign, ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import Badge from '@/components/UI/Badge';
import EmptyState from '@/components/UI/EmptyState';
import FundProjectButton from '@/components/Project/FundProjectButton';
import { formatCents, PAYMENT_STATUS_LABELS } from '@/lib/constants';
import type { EscrowStatus } from '@/lib/constants';
import type { Project, Position, Transaction } from '@/types';

export default async function PaymentsPage({
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

  if (!isOwner) {
    return <p className="text-sm text-muted p-4">Only project owners can view payment details.</p>;
  }

  // Fetch transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, position:positions!position_id(id, title), ticket:tickets!ticket_id(id, ticket_number, title)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  const typedTransactions = (transactions || []) as Transaction[];

  // Compute stats
  const totalBudget = typedProject.budget_cents || 0;
  const allocated = positions.reduce((s, p) => s + (p.pay_rate_cents || 0), 0);
  const earned = positions.reduce((s, p) => s + (p.amount_earned_cents || 0), 0);
  const totalCommission = typedTransactions
    .filter(t => t.type === 'deliverable_approved')
    .reduce((s, t) => s + t.commission_cents, 0);

  const stats = [
    { label: 'Total Budget', value: formatCents(totalBudget), icon: DollarSign, color: 'text-accent' },
    { label: 'Allocated', value: formatCents(allocated), icon: ArrowUpRight, color: 'text-foreground' },
    { label: 'Earned by Agents', value: formatCents(earned), icon: ArrowDownRight, color: 'text-success' },
    { label: 'Platform Fees', value: formatCents(totalCommission), icon: TrendingUp, color: 'text-warning' },
  ];

  return (
    <div className="max-w-5xl">
      <h2 className="font-display text-lg font-bold mb-6">Payments</h2>

      {/* Fund Project */}
      <FundProjectButton
        projectId={projectId}
        escrowAmountCents={typedProject.escrow_amount_cents}
        escrowStatus={typedProject.escrow_status as EscrowStatus}
      />

      {/* Budget overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="card-glow p-4 rounded-md bg-surface border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              <span className="text-xs text-muted">{stat.label}</span>
            </div>
            <p className={`text-lg font-display font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Per-position breakdown */}
      <section className="mb-8">
        <h3 className="font-display text-xs font-medium text-secondary tracking-widest uppercase mb-3">
          Position Breakdown
        </h3>
        {positions.length > 0 ? (
          <div className="space-y-2">
            {positions.map((pos) => {
              const budget = pos.pay_rate_cents || 0;
              const earnedAmt = pos.amount_earned_cents || 0;
              const pct = budget > 0 ? Math.min(100, (earnedAmt / budget) * 100) : 0;
              return (
                <div key={pos.id} className="p-3 rounded-md bg-surface border border-[var(--border)] flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pos.title}</p>
                    <p className="text-xs text-muted">
                      Budget: {budget ? formatCents(budget) : 'None'} · Earned: {formatCents(earnedAmt)}
                    </p>
                  </div>
                  {budget > 0 && (
                    <div className="w-24 h-1.5 rounded-full bg-surface-light overflow-hidden shrink-0">
                      <div
                        className="h-full bg-success rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  <Badge variant={
                    pos.payment_status === 'completed' ? 'success' :
                    pos.payment_status === 'in_progress' ? 'warning' :
                    pos.payment_status === 'funded' ? 'accent' : 'default'
                  }>
                    {PAYMENT_STATUS_LABELS[pos.payment_status as keyof typeof PAYMENT_STATUS_LABELS] || 'Unfunded'}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">No positions created yet.</p>
        )}
      </section>

      {/* Transaction history */}
      <section>
        <h3 className="font-display text-xs font-medium text-secondary tracking-widest uppercase mb-3">
          Transaction History
        </h3>
        {typedTransactions.length > 0 ? (
          <div className="space-y-2">
            {typedTransactions.map((tx) => (
              <div key={tx.id} className="p-3 rounded-md bg-surface border border-[var(--border)] flex items-center gap-3">
                <div className={`p-1.5 rounded-md ${
                  tx.type === 'deliverable_approved' ? 'bg-success/15 text-success' :
                  tx.type === 'refund' ? 'bg-error/15 text-error' : 'bg-muted/15 text-muted'
                }`}>
                  <DollarSign className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{tx.description || tx.type}</p>
                  <p className="text-xs text-muted">
                    {tx.position?.title || 'N/A'}
                    {tx.ticket ? ` · #${tx.ticket.ticket_number}` : ''}
                    {' · '}{new Date(tx.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-success">{formatCents(tx.amount_cents)}</p>
                  {tx.commission_cents > 0 && (
                    <p className="text-[10px] text-muted">Fee: {formatCents(tx.commission_cents)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<DollarSign className="h-10 w-10" />}
            title="No transactions yet"
            description="When you approve deliverables on completed tickets, transactions will appear here."
          />
        )}
      </section>
    </div>
  );
}
