'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/UI/Badge';
import Button from '@/components/UI/Button';
import CreateTicketForm from '@/components/Project/CreateTicketForm';
import TicketDetail from '@/components/Project/TicketDetail';
import { Plus, User } from 'lucide-react';
import { TICKET_STATUS_LABELS, TICKET_TYPE_LABELS, TICKET_TYPE_COLORS, formatCents } from '@/lib/constants';
import type { Ticket, Position } from '@/types';

function stripSim(name: string) {
  return name.replace(/^SIM-/, '');
}

const KANBAN_COLUMNS = ['todo', 'in_progress', 'in_review', 'done'] as const;

interface TicketBoardProps {
  tickets: Ticket[];
  positions: Position[];
  projectId: string;
  userId: string;
  isOwner: boolean;
}

export default function TicketBoard({ tickets, positions, projectId, userId, isOwner }: TicketBoardProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const router = useRouter();

  const maxTicketNumber = tickets.reduce((max, t) => Math.max(max, t.ticket_number), 0);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-bold">Tickets</h2>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Create Ticket
        </Button>
      </div>

      {showCreate && (
        <CreateTicketForm
          projectId={projectId}
          userId={userId}
          positions={positions}
          nextNumber={maxTicketNumber + 1}
          onClose={() => setShowCreate(false)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map((status) => {
          const columnTickets = tickets.filter(t => t.status === status);
          return (
            <div key={status} className="rounded-md bg-surface border border-[var(--border)] p-3 min-h-[300px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-xs font-medium text-secondary tracking-widest uppercase">
                  {TICKET_STATUS_LABELS[status]}
                </h3>
                <span className="text-xs text-muted">{columnTickets.length}</span>
              </div>
              <div className="space-y-2">
                {columnTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="card-glow w-full text-left p-2.5 rounded-md bg-background border border-[var(--border)] hover:border-accent/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-xs text-muted">#{ticket.ticket_number}</span>
                      {ticket.ticket_type && ticket.ticket_type !== 'task' && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${TICKET_TYPE_COLORS[ticket.ticket_type] || 'bg-muted/20 text-muted'}`}>
                          {TICKET_TYPE_LABELS[ticket.ticket_type] || ticket.ticket_type}
                        </span>
                      )}
                      <Badge variant={
                        ticket.priority === 'urgent' ? 'error' :
                        ticket.priority === 'high' ? 'warning' :
                        ticket.priority === 'medium' ? 'accent' : 'default'
                      }>
                        {ticket.priority}
                      </Badge>
                      {ticket.story_points && (
                        <span className="text-[10px] text-muted bg-surface-light px-1.5 py-0.5 rounded">{ticket.story_points}sp</span>
                      )}
                      {ticket.approval_status && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          ticket.approval_status === 'approved' ? 'bg-success/20 text-success' :
                          ticket.approval_status === 'rejected' ? 'bg-error/20 text-error' :
                          ticket.approval_status === 'revision_requested' ? 'bg-warning/20 text-warning' :
                          'bg-muted/20 text-muted'
                        }`}>
                          {ticket.approval_status === 'approved' ? '✓ Approved' :
                           ticket.approval_status === 'rejected' ? '✗ Rejected' :
                           ticket.approval_status === 'revision_requested' ? '↻ Revise' : 'Review'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm truncate">{ticket.title}</p>
                    {ticket.approval_status === 'approved' && ticket.payout_cents && (
                      <p className="text-xs text-success mt-0.5">{formatCents(ticket.payout_cents)}</p>
                    )}
                    {ticket.labels && ticket.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {ticket.labels.slice(0, 2).map(l => (
                          <span key={l} className="text-xs text-muted bg-surface-light px-1.5 py-0.5 rounded">{l}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5 text-xs text-muted">
                      {(() => {
                        const creator = ticket.created_by_agent?.name
                          ? stripSim(ticket.created_by_agent.name)
                          : ticket.created_by_user?.display_name || null;
                        return creator ? <span title="Created by">by {creator}</span> : <span />;
                      })()}
                      {(() => {
                        const assignee = ticket.assignee_agent?.name
                          ? stripSim(ticket.assignee_agent.name)
                          : ticket.assignee_user?.display_name || null;
                        return assignee ? (
                          <span className="flex items-center gap-1" title="Assigned to">
                            <User className="h-3 w-3" />
                            {assignee}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </button>
                ))}
                {columnTickets.length === 0 && (
                  <p className="text-xs text-muted text-center py-4">No tickets</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          positions={positions}
          projectId={projectId}
          userId={userId}
          isOwner={isOwner}
          onClose={() => { setSelectedTicket(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
