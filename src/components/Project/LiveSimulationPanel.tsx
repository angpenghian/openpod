'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/UI/Button';
import { Bot, Square, AlertCircle, Play } from 'lucide-react';

interface SimulationEvent {
  type: 'system' | 'thinking' | 'action' | 'error' | 'refresh' | 'round' | 'done' | 'keepalive';
  agent: string;
  action: string;
  round?: number;
}

interface LiveSimulationPanelProps {
  projectId: string;
  hasGitHub: boolean;
}

export default function LiveSimulationPanel({ projectId, hasGitHub }: LiveSimulationPanelProps) {
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [maxRounds, setMaxRounds] = useState(20);
  const [currentRound, setCurrentRound] = useState(0);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  async function startSimulation() {
    setRunning(true);
    setError(null);
    setEvents([]);
    setDone(false);
    setCurrentRound(0);

    try {
      const res = await fetch(`/api/projects/${projectId}/simulate-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxRounds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error || `HTTP ${res.status}`);
        setRunning(false);
        return;
      }

      if (!res.body) {
        setError('No response stream');
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: SimulationEvent = JSON.parse(line.slice(6));
            if (event.type === 'keepalive') continue;

            if (event.type === 'round' && event.round) {
              setCurrentRound(event.round);
            }

            if (event.type === 'done') {
              setDone(true);
              router.refresh();
            }

            if (event.type === 'refresh') {
              router.refresh();
            }

            if (event.type === 'error') {
              setError(event.action);
            }

            setEvents(prev => [...prev, event]);
          } catch {
            // Malformed JSON line — skip
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    }

    readerRef.current = null;
    setRunning(false);
  }

  function stopSimulation() {
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    setRunning(false);
    setDone(true);
  }

  // Count done tickets from events
  const ticketsDone = events.filter(e => e.action.includes('Approved ticket') || e.action.includes('All tickets completed')).length;

  return (
    <div className="card-glow p-4 rounded-md bg-surface border border-warning/30 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-warning" />
          <h3 className="font-display text-sm font-medium">Admin: Live AI Simulation</h3>
        </div>
        <div className="flex items-center gap-2">
          {!running && !done && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">Rounds:</label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxRounds}
                onChange={e => setMaxRounds(Math.min(100, Math.max(1, Number(e.target.value) || 20)))}
                className="w-14 px-2 py-1 text-xs rounded bg-background border border-[var(--border)] text-foreground"
              />
            </div>
          )}
          {running ? (
            <Button size="sm" variant="secondary" onClick={stopSimulation}>
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={startSimulation}
              disabled={done}
            >
              <Play className="h-3 w-3 mr-1" />
              {done ? 'Complete' : 'Start Live Sim'}
            </Button>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted mb-1">
        LLM-powered agents using real API calls{hasGitHub ? ' + GitHub code writing' : ''}.
        Each agent gets a real API key and calls OpenPod endpoints.
      </p>

      {/* Status bar */}
      {(running || done) && (
        <div className="flex items-center gap-3 text-xs text-muted border-t border-[var(--border)] pt-2 mt-2">
          <span>Round {currentRound}/{maxRounds}</span>
          {ticketsDone > 0 && <span>{ticketsDone} tickets approved</span>}
          {running && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Running
            </span>
          )}
          {done && <span className="text-success">Done</span>}
        </div>
      )}

      {/* Activity feed */}
      {events.length > 0 && (
        <div
          ref={feedRef}
          className="space-y-1 border-t border-[var(--border)] pt-3 mt-2 max-h-80 overflow-y-auto"
        >
          {events
            .filter(e => e.type !== 'keepalive')
            .map((event, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs ${
                  event.type === 'error' ? 'text-error' :
                  event.type === 'thinking' ? 'text-muted italic' :
                  event.type === 'system' || event.type === 'refresh' ? 'text-muted' :
                  'text-foreground'
                }`}
              >
                <span className="font-medium text-muted shrink-0 w-28 truncate" title={event.agent}>
                  {event.agent}
                </span>
                <span>{event.action}</span>
              </div>
            ))}
        </div>
      )}

      {/* Error */}
      {error && !events.some(e => e.type === 'error') && (
        <div className="flex items-start gap-2 text-xs text-error mt-3">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
