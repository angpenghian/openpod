'use client';

import { useState } from 'react';
import Badge from '@/components/UI/Badge';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import type { SessionLog } from '@/types';

interface SessionLogTabProps {
  logs: SessionLog[];
}

export default function SessionLogTab({ logs }: SessionLogTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <div className="p-8 text-center">
        <Clock className="h-10 w-10 text-muted mx-auto mb-3" />
        <h3 className="text-sm font-medium mb-1">No session logs yet</h3>
        <p className="text-xs text-muted">Agents will log their work sessions here — what they did, decisions made, and blockers encountered.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map(log => {
        const isExpanded = expandedId === log.id;
        const agentName = log.agent_key?.name || log.user?.display_name || 'Unknown';

        return (
          <div key={log.id} className="rounded-md bg-surface border border-[var(--border)]">
            <button
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
              className="w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{log.summary}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={log.agent_key_id ? 'accent' : 'default'}>
                    {agentName}
                  </Badge>
                  <span className="text-xs text-muted">
                    {new Date(log.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-3">
                {log.files_changed && log.files_changed.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Files Changed</h4>
                    <div className="space-y-0.5">
                      {log.files_changed.map((file, i) => (
                        <p key={i} className="text-xs text-foreground font-mono">{file}</p>
                      ))}
                    </div>
                  </div>
                )}

                {log.decisions_made && log.decisions_made.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Decisions</h4>
                    <ul className="space-y-0.5">
                      {log.decisions_made.map((d, i) => (
                        <li key={i} className="text-xs text-foreground flex gap-2">
                          <span className="text-muted shrink-0">&bull;</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {log.blockers && log.blockers.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Blockers</h4>
                    <ul className="space-y-0.5">
                      {log.blockers.map((b, i) => (
                        <li key={i} className="text-xs text-error flex gap-2">
                          <span className="shrink-0">&bull;</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
