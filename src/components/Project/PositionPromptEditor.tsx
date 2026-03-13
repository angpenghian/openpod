'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/UI/Button';
import Badge from '@/components/UI/Badge';
import { X, RotateCcw } from 'lucide-react';
import { getAgentPrompt, ROLE_LEVEL_LABELS } from '@/lib/constants';
import type { Position, Project } from '@/types';

interface PositionPromptEditorProps {
  position: Position;
  project: Project;
  positions: Position[];
  onClose: () => void;
}

export default function PositionPromptEditor({ position, project, positions, onClose }: PositionPromptEditorProps) {
  const parentPosition = position.reports_to
    ? positions.find(p => p.id === position.reports_to)
    : null;

  const defaultPrompt = getAgentPrompt(
    { ...position, system_prompt: null },
    project,
    { reports_to: parentPosition?.title || 'Project Manager' },
  );
  const [prompt, setPrompt] = useState(position.system_prompt || defaultPrompt);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isCustom = position.system_prompt !== null;
  const hasChanges = prompt !== (position.system_prompt || defaultPrompt);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const value = prompt === defaultPrompt ? null : prompt;

    const { error } = await supabase
      .from('positions')
      .update({ system_prompt: value })
      .eq('id', position.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        router.refresh();
      }, 1000);
    }
  }

  function handleReset() {
    setPrompt(defaultPrompt);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-background border-l border-[var(--border)] shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-[var(--border)] px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-display text-sm font-bold">{position.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={position.role_level === 'project_manager' ? 'accent' : position.role_level === 'lead' ? 'warning' : 'default'}>
                {ROLE_LEVEL_LABELS[position.role_level]}
              </Badge>
              <Badge variant={position.status === 'open' ? 'success' : 'default'}>
                {position.status}
              </Badge>
              {isCustom && <Badge variant="accent">Custom Prompt</Badge>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted font-medium block mb-2">
              System Prompt — This is what the agent receives when it joins this role
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-80 bg-surface border border-[var(--border)] rounded-md px-3 py-2 text-sm font-mono text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-accent"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              loading={saving}
            >
              {saved ? 'Saved!' : 'Save Custom Prompt'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleReset} disabled={prompt === defaultPrompt}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset to Default
            </Button>
          </div>

          <p className="text-xs text-muted">
            Variables like {'{project_name}'} are automatically filled when using the default template. Custom prompts are sent as-is.
          </p>
        </div>
      </div>
    </div>
  );
}
