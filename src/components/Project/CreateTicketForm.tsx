'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Plus, X } from 'lucide-react';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import TextArea from '@/components/UI/TextArea';
import type { Position } from '@/types';
import type { TicketPriority } from '@/lib/constants';
import { TICKET_TYPES, TICKET_TYPE_LABELS, TICKET_DESCRIPTION_PLACEHOLDERS, TICKET_MIN_DESCRIPTION_LENGTH } from '@/lib/constants';
import type { TicketType } from '@/types';

interface CreateTicketFormProps {
  projectId: string;
  userId: string;
  positions: Position[];
  nextNumber: number;
  onClose: () => void;
}

export default function CreateTicketForm({ projectId, userId, positions, nextNumber, onClose }: CreateTicketFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [ticketType, setTicketType] = useState<TicketType>('task');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>([]);
  const [newCriterion, setNewCriterion] = useState('');
  const [assigneeAgentKeyId, setAssigneeAgentKeyId] = useState('');
  const [storyPoints, setStoryPoints] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Get filled positions (agents that can be assigned work)
  const filledPositions = positions.filter(p => p.status === 'filled' && p.member);

  function addCriterion() {
    if (newCriterion.trim()) {
      setAcceptanceCriteria(prev => [...prev, newCriterion.trim()]);
      setNewCriterion('');
    }
  }

  function removeCriterion(index: number) {
    setAcceptanceCriteria(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    await supabase.from('tickets').insert({
      project_id: projectId,
      ticket_number: nextNumber,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      ticket_type: ticketType,
      acceptance_criteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : null,
      assignee_agent_key_id: assigneeAgentKeyId || null,
      story_points: storyPoints ? parseInt(storyPoints) : null,
      status: 'todo',
      created_by_user_id: userId,
    });

    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-md bg-surface border border-accent/20 space-y-3">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        autoFocus
      />
      <div>
        <TextArea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder={TICKET_DESCRIPTION_PLACEHOLDERS[ticketType] || 'Details, context, file references...'}
        />
        {['story', 'task', 'bug'].includes(ticketType) && (
          <div className={`text-xs mt-1 ${description.trim().length < TICKET_MIN_DESCRIPTION_LENGTH ? 'text-error' : 'text-muted'}`}>
            {description.trim().length}/{TICKET_MIN_DESCRIPTION_LENGTH} min characters
          </div>
        )}
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
          <label className="text-sm text-muted mb-1 block">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-muted mb-1 block">Assign to</label>
          <select
            value={assigneeAgentKeyId}
            onChange={(e) => setAssigneeAgentKeyId(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50"
          >
            <option value="">Unassigned</option>
            {filledPositions.map(p => (
              <option key={p.member!.agent_key_id} value={p.member!.agent_key_id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-muted mb-1 block">Story Points</label>
          <input
            type="number"
            min="1"
            max="100"
            value={storyPoints}
            onChange={(e) => setStoryPoints(e.target.value)}
            placeholder="e.g. 3"
            className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50"
          />
        </div>
      </div>

      {/* Acceptance Criteria */}
      <div>
        <label className="text-sm text-muted mb-1 block">
          Acceptance Criteria
          {ticketType === 'story' && <span className="text-error ml-1">*</span>}
        </label>
        {ticketType === 'story' && acceptanceCriteria.length === 0 && (
          <p className="text-xs text-error mb-2">Stories require at least one acceptance criterion.</p>
        )}
        {acceptanceCriteria.length > 0 && (
          <ul className="space-y-1 mb-2">
            {acceptanceCriteria.map((criterion, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-secondary mt-0.5">-</span>
                <span className="flex-1">{criterion}</span>
                <button type="button" onClick={() => removeCriterion(i)} className="text-muted hover:text-error cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={newCriterion}
            onChange={(e) => setNewCriterion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCriterion(); } }}
            placeholder="Add a criterion..."
            className="flex-1 px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
          />
          <button
            type="button"
            onClick={addCriterion}
            disabled={!newCriterion.trim()}
            className="px-2 py-1.5 rounded-md bg-surface-light text-muted hover:text-foreground disabled:opacity-30 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving} disabled={
          !title.trim() ||
          (['story', 'task', 'bug'].includes(ticketType) && description.trim().length < TICKET_MIN_DESCRIPTION_LENGTH) ||
          (ticketType === 'story' && acceptanceCriteria.length === 0)
        }>Create #{nextNumber}</Button>
      </div>
    </form>
  );
}
