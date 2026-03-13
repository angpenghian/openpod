'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import TextArea from '@/components/UI/TextArea';
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_TEMPLATES, KNOWLEDGE_MIN_CONTENT_LENGTH } from '@/lib/constants';
import type { KnowledgeEntry } from '@/types';
import type { KnowledgeCategory } from '@/lib/constants';

const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  architecture: 'Architecture',
  decisions: 'Decisions',
  patterns: 'Patterns',
  context: 'Context',
  general: 'General',
};

interface KnowledgeFormProps {
  projectId: string;
  userId: string;
  entry?: KnowledgeEntry;
  onClose: () => void;
  onSaved: () => void;
}

export default function KnowledgeForm({ projectId, userId, entry, onClose, onSaved }: KnowledgeFormProps) {
  const isEdit = !!entry;
  const [title, setTitle] = useState(entry?.title || '');
  const [category, setCategory] = useState<KnowledgeCategory>(entry?.category || 'general');
  const [content, setContent] = useState(entry?.content || '');
  const [tags, setTags] = useState(entry?.tags?.join(', ') || '');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    if (isEdit && entry) {
      const newVersion = entry.version + 1;

      await supabase.from('knowledge_entries').update({
        title: title.trim(),
        content: content.trim(),
        category,
        tags: parsedTags.length > 0 ? parsedTags : null,
        version: newVersion,
      }).eq('id', entry.id);

      await supabase.from('knowledge_versions').insert({
        entry_id: entry.id,
        version: newVersion,
        title: title.trim(),
        content: content.trim(),
        changed_by_user_id: userId,
      });
    } else {
      await supabase.from('knowledge_entries').insert({
        project_id: projectId,
        title: title.trim(),
        content: content.trim(),
        category,
        tags: parsedTags.length > 0 ? parsedTags : null,
        version: 1,
        created_by_user_id: userId,
      });
    }

    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-md bg-surface border border-accent/20 space-y-3">
      <h3 className="text-sm font-medium mb-1">{isEdit ? 'Edit Entry' : 'New Knowledge Entry'}</h3>

      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Database schema decisions"
        autoFocus
      />

      <div>
        <label className="text-sm text-muted mb-1 block">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
          className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50"
        >
          {KNOWLEDGE_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
      </div>

      <div>
        <TextArea
          label="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder={KNOWLEDGE_TEMPLATES[category] || 'Document the knowledge, decision, or pattern...'}
        />
        <div className={`text-xs mt-1 ${content.trim().length < KNOWLEDGE_MIN_CONTENT_LENGTH ? 'text-error' : 'text-muted'}`}>
          {content.trim().length}/{KNOWLEDGE_MIN_CONTENT_LENGTH} min characters
        </div>
      </div>

      <Input
        label="Tags (comma-separated)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="e.g. database, schema, postgres"
      />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving} disabled={!title.trim() || content.trim().length < KNOWLEDGE_MIN_CONTENT_LENGTH}>
          {isEdit ? 'Save Changes' : 'Create Entry'}
        </Button>
      </div>
    </form>
  );
}
