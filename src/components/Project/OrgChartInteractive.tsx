'use client';

import { useState } from 'react';
import Badge from '@/components/UI/Badge';
import PositionPromptEditor from '@/components/Project/PositionPromptEditor';
import { Crown, Shield, Wrench, User } from 'lucide-react';
import { formatCents, ROLE_LEVEL_LABELS } from '@/lib/constants';
import type { Position, Project } from '@/types';

interface OrgChartInteractiveProps {
  positions: Position[];
  project: Project;
}

export default function OrgChartInteractive({ positions, project }: OrgChartInteractiveProps) {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const pm = positions.find(p => p.role_level === 'project_manager');
  const leads = positions.filter(p => p.role_level === 'lead');
  const workers = positions.filter(p => p.role_level === 'worker');

  return (
    <>
      <div className="card-glow p-4 rounded-md bg-surface border border-[var(--border)]">
        {/* CEO (Human) */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-md bg-accent/15 flex items-center justify-center">
            <User className="h-4 w-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium">You</p>
            <p className="text-xs text-muted">CEO / Project Owner</p>
          </div>
        </div>

        {pm && (
          <div className="ml-6 border-l border-[var(--border)] pl-4 mb-3">
            <OrgNode position={pm} icon={Crown} onClick={() => setSelectedPosition(pm)} />
            {leads.length > 0 && (
              <div className="ml-6 border-l border-[var(--border)] pl-4 mt-3 space-y-3">
                {leads.map((lead) => (
                  <div key={lead.id}>
                    <OrgNode position={lead} icon={Shield} onClick={() => setSelectedPosition(lead)} />
                    {workers.filter(w => w.reports_to === lead.id).length > 0 && (
                      <div className="ml-6 border-l border-[var(--border)] pl-4 mt-3 space-y-3">
                        {workers.filter(w => w.reports_to === lead.id).map((worker) => (
                          <OrgNode key={worker.id} position={worker} icon={Wrench} onClick={() => setSelectedPosition(worker)} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {workers.filter(w => !w.reports_to || w.reports_to === pm.id).length > 0 && (
              <div className="ml-6 border-l border-[var(--border)] pl-4 mt-3 space-y-3">
                {workers.filter(w => !w.reports_to || w.reports_to === pm.id).map((worker) => (
                  <OrgNode key={worker.id} position={worker} icon={Wrench} onClick={() => setSelectedPosition(worker)} />
                ))}
              </div>
            )}
          </div>
        )}

        {!pm && positions.length > 0 && (
          <div className="ml-6 border-l border-[var(--border)] pl-4 space-y-3">
            {positions.map((pos) => (
              <OrgNode key={pos.id} position={pos} icon={pos.role_level === 'lead' ? Shield : Wrench} onClick={() => setSelectedPosition(pos)} />
            ))}
          </div>
        )}

        {positions.length === 0 && (
          <p className="text-sm text-muted ml-6">No positions defined.</p>
        )}

        <p className="text-xs text-muted mt-3 pt-3 border-t border-[var(--border)]">
          Click any role to view or edit its agent prompt.
        </p>
      </div>

      {selectedPosition && (
        <PositionPromptEditor
          position={selectedPosition}
          project={project}
          positions={positions}
          onClose={() => setSelectedPosition(null)}
        />
      )}
    </>
  );
}

function OrgNode({ position, icon: Icon, onClick }: { position: Position; icon: typeof Crown; onClick: () => void }) {
  const colorClass = position.role_level === 'project_manager' ? 'text-accent' : position.role_level === 'lead' ? 'text-warning' : 'text-muted';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full text-left group hover:bg-surface-light/50 rounded-md p-1.5 -ml-1.5 transition-colors cursor-pointer"
    >
      <div className="h-8 w-8 rounded-md bg-surface-light flex items-center justify-center shrink-0 group-hover:ring-1 group-hover:ring-accent/30 transition-all">
        <Icon className={`h-4 w-4 ${colorClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{position.title}</p>
          <Badge variant={position.role_level === 'project_manager' ? 'accent' : position.role_level === 'lead' ? 'warning' : 'default'}>
            {ROLE_LEVEL_LABELS[position.role_level]}
          </Badge>
          <Badge variant={position.status === 'open' ? 'success' : 'default'}>
            {position.status}
          </Badge>
        </div>
        {position.required_capabilities && position.required_capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {position.required_capabilities.slice(0, 4).map((cap) => (
              <span key={cap} className="text-xs text-muted">{cap}</span>
            ))}
          </div>
        )}
      </div>
      {position.pay_rate_cents && (
        <span className="text-xs text-accent shrink-0">
          {formatCents(position.pay_rate_cents)} {position.pay_type}
        </span>
      )}
    </button>
  );
}
