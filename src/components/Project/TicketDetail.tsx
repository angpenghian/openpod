'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/UI/Button';
import Badge from '@/components/UI/Badge';
import { X, Send, GitPullRequest, CheckCircle, XCircle, Clock, Minus } from 'lucide-react';
import { TICKET_STATUS_LABELS, TICKET_PRIORITIES, TICKET_TYPES, TICKET_TYPE_LABELS, APPROVAL_STATUS_LABELS, COMMISSION_RATE, formatCents } from '@/lib/constants';
import type { Ticket, TicketComment, Position, TicketType, ApprovalStatus } from '@/types';

function stripSim(name: string) {
  return name.replace(/^SIM-/, '');
}

interface TicketDetailProps {
  ticket: Ticket;
  positions: Position[];
  projectId: string;
  userId: string;
  isOwner: boolean;
  onClose: () => void;
}

export default function TicketDetail({ ticket, projectId, userId, isOwner, onClose }: TicketDetailProps) {
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description || '');
  const [priority, setPriority] = useState(ticket.priority);
  const [status, setStatus] = useState(ticket.status);
  const [ticketType, setTicketType] = useState<TicketType>(ticket.ticket_type || 'task');
  const [branch, setBranch] = useState(ticket.branch || '');
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(ticket.approval_status || null);
  const [payoutCents, setPayoutCents] = useState(ticket.payout_cents || 0);
  const [approving, setApproving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadComments() {
      const { data } = await supabase
        .from('ticket_comments')
        .select('*, author_agent:agent_keys!author_agent_key_id(name), author_user:profiles!author_user_id(display_name)')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      setComments((data || []) as TicketComment[]);
    }
    loadComments();
  }, [ticket.id, supabase]);

  async function handleSave() {
    setSaving(true);
    await supabase.from('tickets').update({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      ticket_type: ticketType,
      branch: branch.trim() || null,
    }).eq('id', ticket.id);
    setSaving(false);
    onClose();
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    setSendingComment(true);
    const { data } = await supabase.from('ticket_comments').insert({
      ticket_id: ticket.id,
      author_user_id: userId,
      content: newComment.trim(),
    }).select('*, author_agent:agent_keys!author_agent_key_id(name), author_user:profiles!author_user_id(display_name)').single();
    if (data) setComments(prev => [...prev, data as TicketComment]);
    setNewComment('');
    setSendingComment(false);
  }

  async function handleApproval(newStatus: ApprovalStatus) {
    setApproving(true);
    const updates: Record<string, unknown> = {
      approval_status: newStatus,
      approved_at: new Date().toISOString(),
      approved_by: userId,
    };

    if (newStatus === 'approved') {
      updates.payout_cents = payoutCents;
    }

    if (newStatus === 'revision_requested') {
      updates.status = 'in_progress';
    }

    await supabase.from('tickets').update(updates).eq('id', ticket.id);

    if (newStatus === 'approved' && payoutCents > 0) {
      // Find position_id via assignee's project membership
      let positionId: string | null = null;
      if (ticket.assignee_agent_key_id) {
        const { data: member } = await supabase
          .from('project_members')
          .select('position_id')
          .eq('project_id', projectId)
          .eq('agent_key_id', ticket.assignee_agent_key_id)
          .single();
        positionId = member?.position_id || null;
      }

      const commissionCents = Math.round(payoutCents * COMMISSION_RATE);
      await supabase.from('transactions').insert({
        project_id: projectId,
        position_id: positionId,
        ticket_id: ticket.id,
        amount_cents: payoutCents - commissionCents,
        commission_cents: commissionCents,
        type: 'deliverable_approved',
        description: `Approved: #${ticket.ticket_number} ${ticket.title}`,
      });
    }

    setApprovalStatus(newStatus);
    setApproving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md bg-background border-l border-[var(--border)] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-muted">#{ticket.ticket_number}</span>
          <button onClick={onClose} className="text-muted hover:text-foreground cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted mb-1 block">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50"
            />
          </div>

          <div>
            <label className="text-sm text-muted mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted mb-1 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Ticket['status'])}
                className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50"
              >
                {(['todo', 'in_progress', 'in_review', 'done', 'cancelled'] as const).map(s => (
                  <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted mb-1 block">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Ticket['priority'])}
                className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50"
              >
                {TICKET_PRIORITIES.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted mb-1 block">Type</label>
              <select
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value as TicketType)}
                className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50"
              >
                {TICKET_TYPES.map(t => (
                  <option key={t} value={t}>{TICKET_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted mb-1 block">Branch</label>
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="feature/..."
                className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm font-mono focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          {/* Acceptance Criteria */}
          {ticket.acceptance_criteria && ticket.acceptance_criteria.length > 0 && (
            <div>
              <label className="text-sm text-muted mb-1 block">Acceptance Criteria</label>
              <ul className="space-y-1">
                {ticket.acceptance_criteria.map((criterion, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-secondary mt-0.5">-</span>
                    <span className="text-foreground">{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Deliverables */}
          {ticket.deliverables && Array.isArray(ticket.deliverables) && ticket.deliverables.length > 0 && (
            <div>
              <label className="text-sm text-muted mb-1 block">Deliverables</label>
              <ul className="space-y-2">
                {ticket.deliverables.map((d, i) => {
                  const isPR = d.url?.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/);
                  return (
                    <li key={i} className="text-sm">
                      {d.url ? (
                        <div className="flex items-center gap-2">
                          {isPR && <GitPullRequest className="h-3.5 w-3.5 text-accent shrink-0" />}
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate">
                            {d.label || d.type}
                          </a>
                          {isPR && <PRStatusBadge prUrl={d.url} projectId={projectId} />}
                        </div>
                      ) : (
                        <span className="text-foreground">{d.label || d.type}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Story Points */}
          {ticket.story_points && (
            <div className="text-xs text-muted">
              Story Points: <span className="text-foreground">{ticket.story_points}</span>
            </div>
          )}

          <div className="text-xs text-muted space-y-1">
            <p>
              Created {new Date(ticket.created_at).toLocaleDateString()}
              {(() => {
                const creator = ticket.created_by_agent?.name
                  ? stripSim(ticket.created_by_agent.name)
                  : ticket.created_by_user?.display_name || null;
                return creator ? ` by ${creator}` : '';
              })()}
            </p>
            {(() => {
              const assignee = ticket.assignee_agent?.name
                ? stripSim(ticket.assignee_agent.name)
                : ticket.assignee_user?.display_name || null;
              return assignee ? <p>Assigned to <span className="text-foreground">{assignee}</span></p> : null;
            })()}
          </div>

          {/* Deliverable Approval */}
          {isOwner && (status === 'done' || status === 'in_review') && (
            <div className="p-3 rounded-md bg-surface-light border border-[var(--border)]">
              <h4 className="text-sm font-medium mb-2">Deliverable Approval</h4>

              {approvalStatus && (
                <Badge variant={
                  approvalStatus === 'approved' ? 'success' :
                  approvalStatus === 'rejected' ? 'error' :
                  approvalStatus === 'revision_requested' ? 'warning' : 'default'
                } className="mb-2">
                  {APPROVAL_STATUS_LABELS[approvalStatus]}
                </Badge>
              )}

              {(!approvalStatus || approvalStatus === 'pending_review') && (
                <>
                  <div className="mb-3">
                    <label className="text-xs text-muted mb-1 block">Payout Amount</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payoutCents / 100}
                        onChange={(e) => setPayoutCents(Math.round(parseFloat(e.target.value || '0') * 100))}
                        className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50"
                      />
                    </div>
                    {payoutCents > 0 && (
                      <p className="text-xs text-muted mt-1">
                        Agent receives: {formatCents(payoutCents - Math.round(payoutCents * COMMISSION_RATE))} · Platform fee: {formatCents(Math.round(payoutCents * COMMISSION_RATE))}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproval('approved')}
                      disabled={approving}
                      className="flex-1 px-3 py-1.5 rounded-md bg-success/15 text-success border border-success/20 text-xs font-medium hover:bg-success/25 disabled:opacity-50 cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApproval('revision_requested')}
                      disabled={approving}
                      className="flex-1 px-3 py-1.5 rounded-md bg-warning/15 text-warning border border-warning/20 text-xs font-medium hover:bg-warning/25 disabled:opacity-50 cursor-pointer"
                    >
                      Revise
                    </button>
                    <button
                      onClick={() => handleApproval('rejected')}
                      disabled={approving}
                      className="flex-1 px-3 py-1.5 rounded-md bg-error/15 text-error border border-error/20 text-xs font-medium hover:bg-error/25 disabled:opacity-50 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}

              {approvalStatus === 'approved' && ticket.payout_cents && (
                <p className="text-xs text-success mt-1">Paid out: {formatCents(ticket.payout_cents)}</p>
              )}
            </div>
          )}

          <Button onClick={handleSave} loading={saving} className="w-full">
            Save Changes
          </Button>
        </div>

        {/* Comments */}
        <div className="mt-6 pt-4 border-t border-[var(--border)]">
          <h3 className="text-sm font-medium mb-3">Comments</h3>
          <div className="space-y-3 mb-4">
            {comments.map(c => {
              const isAgent = !!c.author_agent_key_id;
              const rawName = c.author_user?.display_name || c.author_agent?.name || (c.author_user_id === userId ? 'You' : 'Unknown');
              const authorName = isAgent ? stripSim(rawName) : rawName;
              return (
                <div key={c.id} className="text-sm">
                  <p className="text-xs text-muted mb-0.5">
                    <span className={isAgent ? 'text-secondary' : 'text-accent'}>{authorName}</span>
                    {isAgent && <span className="text-secondary/60 ml-1">bot</span>}
                    {' '}&middot; {new Date(c.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-foreground">{c.content}</p>
                </div>
              );
            })}
            {comments.length === 0 && (
              <p className="text-xs text-muted">No comments yet.</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || sendingComment}
              className="px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Inline PR status badge — fetches CI check status for a PR deliverable */
function PRStatusBadge({ prUrl, projectId }: { prUrl: string; projectId: string }) {
  const [status, setStatus] = useState<'loading' | 'passed' | 'failed' | 'pending' | 'merged' | 'no_checks' | 'error'>('loading');

  useEffect(() => {
    async function checkPR() {
      try {
        const res = await fetch('/api/agent/v1/github/verify-deliverable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId, pr_url: prUrl }),
        });
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const data = await res.json();
        if (data.merged) {
          setStatus('merged');
        } else if (data.checks_summary === 'all_passed') {
          setStatus('passed');
        } else if (data.checks_summary === 'some_failed') {
          setStatus('failed');
        } else if (data.checks_summary === 'pending') {
          setStatus('pending');
        } else {
          setStatus('no_checks');
        }
      } catch {
        setStatus('error');
      }
    }
    checkPR();
  }, [prUrl, projectId]);

  if (status === 'loading') return <Clock className="h-3 w-3 text-muted animate-pulse shrink-0" />;
  if (status === 'error') return null;

  const config = {
    passed: { icon: CheckCircle, color: 'text-success', label: 'CI passed' },
    failed: { icon: XCircle, color: 'text-error', label: 'CI failed' },
    pending: { icon: Clock, color: 'text-warning', label: 'CI running' },
    merged: { icon: GitPullRequest, color: 'text-[#a371f7]', label: 'Merged' },
    no_checks: { icon: Minus, color: 'text-muted', label: 'No CI' },
  }[status];

  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${config.color} shrink-0`} title={config.label}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
