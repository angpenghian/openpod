'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/UI/Button';
import { Bot, CheckCircle, AlertCircle, Zap, Loader2, Square } from 'lucide-react';

export interface SimEvent {
  agent: string;
  action: string;
  type?: string;
}

interface SimulationButtonProps {
  projectId: string;
  hasSimulated: boolean;
  onSimEvent?: (event: SimEvent) => void;
}

interface ActionItem {
  agent: string;
  action: string;
  type?: string;
}

export default function SimulationButton({ projectId, hasSimulated, onSimEvent }: SimulationButtonProps) {
  const [running, setRunning] = useState(false);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [rounds, setRounds] = useState(10);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Auto-scroll to bottom when new actions appear
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [actions]);

  function stopSimulation() {
    abortRef.current?.abort();
    setRunning(false);
    setDone(true);
    router.refresh();
  }

  async function runLiveSimulation() {
    setRunning(true);
    setError(null);
    setActions([]);
    setDone(false);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch(`/api/projects/${projectId}/simulate-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxRounds: rounds }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Simulation failed');
        setRunning(false);
        return;
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        setError('No stream available');
        setRunning(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by \n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6)) as ActionItem;

            if (data.type === 'done') {
              setDone(true);
              setRunning(false);
              router.refresh();
              continue;
            }

            if (data.type === 'error') {
              setError(data.action);
              setRunning(false);
              continue;
            }

            setActions(prev => [...prev, data]);
            onSimEvent?.(data);
          } catch {
            // Skip malformed events
          }
        }
      }

      setRunning(false);
      setDone(prev => {
        if (!prev) router.refresh();
        return true;
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User stopped the simulation — already handled in stopSimulation()
        return;
      }
      setError('Network error — could not run simulation');
      setRunning(false);
    }
  }

  async function runScriptedSimulation() {
    setRunning(true);
    setError(null);
    setActions([]);

    try {
      const res = await fetch(`/api/projects/${projectId}/simulate`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Simulation failed');
        return;
      }

      setActions((data.actions || []).map((a: string) => ({ agent: 'System', action: a })));
      setDone(true);
      router.refresh();
    } catch {
      setError('Network error — could not run simulation');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card-glow p-4 rounded-md bg-surface border border-[var(--border)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-secondary" />
          <h3 className="font-display text-sm font-medium">Agent Simulation</h3>
        </div>
        <div className="flex items-center gap-2">
          {!done && !running && (
            <>
              <div className="flex items-center gap-1.5">
                <label htmlFor="sim-rounds" className="text-xs text-muted">Rounds:</label>
                <input
                  id="sim-rounds"
                  type="number"
                  min={1}
                  max={200}
                  value={rounds}
                  onChange={(e) => setRounds(Math.max(1, parseInt(e.target.value) || 10))}
                  className="w-14 px-1.5 py-0.5 text-xs rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--foreground)] text-center"
                />
              </div>
              <Button size="sm" variant="secondary" onClick={runScriptedSimulation} disabled={hasSimulated}>
                Scripted Demo
              </Button>
            </>
          )}
          {running && (
            <Button size="sm" variant="ghost" onClick={stopSimulation}>
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          )}
          <Button
            size="sm"
            variant={done ? 'ghost' : 'primary'}
            onClick={runLiveSimulation}
            disabled={running || done}
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Agents working...
              </>
            ) : done ? (
              'Simulation Complete'
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 mr-1" />
                Live Simulation
              </>
            )}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted mb-3">
        {done
          ? 'AI agents have interacted in your workspace. Check Tickets, Chat, Memory, and Team tabs.'
          : `Spawn 3 AI agents powered by GPT-4o-mini. They'll analyze your project, create tickets, chat, and coordinate — all with real LLM reasoning. (~$0.002/round)`}
      </p>

      {/* Action log — streams in real-time */}
      {actions.length > 0 && (
        <div ref={logRef} className="space-y-1.5 border-t border-[var(--border)] pt-3 max-h-96 overflow-y-auto">
          {actions.map((item, i) => (
            <div key={i} className={`flex items-start gap-2 text-xs ${item.type === 'thinking' ? 'opacity-60' : ''}`}>
              {item.type === 'thinking' ? (
                <Loader2 className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
              )}
              <span className="text-secondary font-medium shrink-0">{item.agent}</span>
              <span className="text-muted">{item.action}</span>
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-2 text-xs text-muted pt-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Waiting for next agent...</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-error border-t border-[var(--border)] pt-3">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
