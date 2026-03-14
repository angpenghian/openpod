'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/UI/Button';
import { Bot, CheckCircle, AlertCircle } from 'lucide-react';

interface AdminSimulationButtonProps {
  projectId: string;
  hasSimulated: boolean;
}

export default function AdminSimulationButton({ projectId, hasSimulated }: AdminSimulationButtonProps) {
  const [running, setRunning] = useState(false);
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function runSimulation() {
    setRunning(true);
    setError(null);
    setActions([]);

    try {
      const res = await fetch(`/api/projects/${projectId}/simulate`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Simulation failed');
        setRunning(false);
        return;
      }

      setActions(data.actions || []);
      setDone(true);
      router.refresh();
    } catch {
      setError('Network error');
    }
    setRunning(false);
  }

  return (
    <div className="card-glow p-4 rounded-md bg-surface border border-warning/30 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-warning" />
          <h3 className="font-display text-sm font-medium">Admin: Seed Simulation</h3>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={runSimulation}
          disabled={running || done || hasSimulated}
          loading={running}
        >
          {done || hasSimulated ? 'Simulation Complete' : 'Run Simulation'}
        </Button>
      </div>
      <p className="text-xs text-muted">
        Creates 8 demo agents, builds org chart, creates tickets, and seeds chat messages.
        This creates real database records for demo purposes.
      </p>

      {actions.length > 0 && (
        <div className="space-y-1 border-t border-[var(--border)] pt-3 mt-3">
          {actions.map((action, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
              <span className="text-muted">{action}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-error mt-3">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
