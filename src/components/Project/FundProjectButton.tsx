'use client';

import { useState } from 'react';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Badge from '@/components/UI/Badge';
import { DollarSign, ExternalLink } from 'lucide-react';
import { formatCents, ESCROW_STATUS_LABELS } from '@/lib/constants';
import type { EscrowStatus } from '@/lib/constants';

interface FundProjectButtonProps {
  projectId: string;
  escrowAmountCents: number;
  escrowStatus: EscrowStatus;
}

export default function FundProjectButton({
  projectId,
  escrowAmountCents,
  escrowStatus,
}: FundProjectButtonProps) {
  const [amountDollars, setAmountDollars] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleFund() {
    setError('');
    const dollars = parseFloat(amountDollars);
    if (isNaN(dollars) || dollars < 1) {
      setError('Minimum amount is $1.00');
      return;
    }
    if (dollars > 1_000_000) {
      setError('Maximum amount is $1,000,000');
      return;
    }

    const amountCents = Math.round(dollars * 100);
    setLoading(true);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, amount_cents: amountCents }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create checkout session');
        setLoading(false);
        return;
      }

      if (!data?.data?.checkout_url) {
        setError('Invalid response from server');
        setLoading(false);
        return;
      }
      window.location.href = data.data.checkout_url;
    } catch {
      setError('Network error');
      setLoading(false);
    }
  }

  const statusBadgeVariant =
    escrowStatus === 'funded' || escrowStatus === 'released' ? 'success' :
    escrowStatus === 'pending' ? 'warning' :
    escrowStatus === 'partially_released' ? 'accent' :
    escrowStatus === 'refunded' ? 'error' : 'default';

  return (
    <div className="card-glow p-4 rounded-md bg-surface border border-[var(--border)] mb-6">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-4 w-4 text-accent" />
        <h3 className="font-display text-sm font-medium">Fund Project</h3>
      </div>

      <div className="flex items-center justify-between mb-4 p-3 rounded-md bg-[var(--bg)]">
        <div>
          <p className="text-xs text-muted">Escrow Balance</p>
          <p className="text-lg font-display font-bold text-foreground">{formatCents(escrowAmountCents)}</p>
        </div>
        <Badge variant={statusBadgeVariant}>
          {ESCROW_STATUS_LABELS[escrowStatus]}
        </Badge>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="Amount (USD)"
            type="number"
            min="1"
            max="1000000"
            step="0.01"
            placeholder="100.00"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
          />
        </div>
        <Button onClick={handleFund} loading={loading} disabled={!amountDollars}>
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Fund via Stripe
        </Button>
      </div>

      {error && <p className="text-xs text-error mt-2">{error}</p>}

      <p className="text-xs text-muted mt-3">
        Funds are held in escrow and released to agents when deliverables are approved. 10% platform fee on payouts.
      </p>
    </div>
  );
}
