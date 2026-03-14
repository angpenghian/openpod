'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/UI/Button';
import Badge from '@/components/UI/Badge';
import { createClient } from '@/lib/supabase/client';
import { CreditCard, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface AgentPayoutInfo {
  id: string;
  name: string;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
}

type PayoutStatus = 'not_started' | 'pending' | 'onboarded';

interface AgentPayoutRow {
  agent: AgentPayoutInfo;
  status: PayoutStatus;
}

export default function SetupPayoutsButton({ userId }: { userId: string }) {
  const [agents, setAgents] = useState<AgentPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadAgents = useCallback(async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from('agent_registry')
      .select('id, name, stripe_account_id, stripe_onboarded')
      .eq('builder_id', userId)
      .eq('status', 'active')
      .limit(20);

    if (queryError) {
      console.error('Failed to load agents:', queryError.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setLoading(false);
      return;
    }

    const rows: AgentPayoutRow[] = data.map((agent) => ({
      agent: agent as AgentPayoutInfo,
      status: agent.stripe_onboarded
        ? 'onboarded'
        : agent.stripe_account_id
        ? 'pending'
        : 'not_started',
    }));

    setAgents(rows);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  async function handleOnboard(agentId: string) {
    setError('');
    setActionLoading(agentId);

    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_registry_id: agentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start onboarding');
        setActionLoading(null);
        return;
      }

      if (data.data.status === 'already_onboarded') {
        setAgents((prev) =>
          prev.map((a) => (a.agent.id === agentId ? { ...a, status: 'onboarded' as const } : a))
        );
        setActionLoading(null);
        return;
      }

      window.open(data.data.onboarding_url, '_blank');

      setAgents((prev) =>
        prev.map((a) => (a.agent.id === agentId ? { ...a, status: 'pending' as const } : a))
      );
    } catch {
      setError('Network error');
    }
    setActionLoading(null);
  }

  async function handleCheckStatus(agentId: string) {
    setError('');
    setActionLoading(agentId);

    try {
      const res = await fetch(`/api/stripe/connect/status?agent_registry_id=${agentId}`);
      const data = await res.json();

      if (res.ok && data.data) {
        const validStatuses: PayoutStatus[] = ['not_started', 'pending', 'onboarded'];
        const mappedStatus: PayoutStatus = validStatuses.includes(data.data.status)
          ? data.data.status
          : 'not_started';
        setAgents((prev) =>
          prev.map((a) =>
            a.agent.id === agentId ? { ...a, status: mappedStatus } : a
          )
        );
      }
    } catch {
      setError('Failed to check status');
    }
    setActionLoading(null);
  }

  if (loading || agents.length === 0) return null;

  return (
    <div className="pt-6 border-t border-[var(--border)] space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="h-4 w-4 text-muted" />
        <h2 className="text-sm font-semibold">Agent Payouts (Stripe Connect)</h2>
      </div>
      <p className="text-xs text-muted mb-3">
        Set up Stripe Connect so your agents can receive payouts when their work is approved.
      </p>

      <div className="space-y-2">
        {agents.map(({ agent, status }) => (
          <div
            key={agent.id}
            className="flex items-center gap-3 p-3 rounded-md bg-surface border border-[var(--border)]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{agent.name}</p>
            </div>

            {status === 'onboarded' && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-success" />
                <Badge variant="success">Payouts Active</Badge>
              </div>
            )}

            {status === 'pending' && (
              <div className="flex items-center gap-2">
                <Badge variant="warning">Pending</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCheckStatus(agent.id)}
                  loading={actionLoading === agent.id}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Check
                </Button>
              </div>
            )}

            {status === 'not_started' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleOnboard(agent.id)}
                loading={actionLoading === agent.id}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Set Up Payouts
              </Button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-error bg-error/10 rounded-md px-3 py-2">{error}</p>
      )}
    </div>
  );
}
