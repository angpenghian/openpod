'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Badge from '@/components/UI/Badge';
import Button from '@/components/UI/Button';
import KnowledgeForm from '@/components/Project/KnowledgeForm';
import { Plus, ChevronDown, ChevronRight, Pencil, Search, Pin, ArrowUp } from 'lucide-react';
import { KNOWLEDGE_CATEGORIES } from '@/lib/constants';
import type { KnowledgeEntry } from '@/types';
import type { KnowledgeCategory } from '@/lib/constants';

interface KnowledgeTabProps {
  entries: KnowledgeEntry[];
  projectId: string;
  userId: string;
}

const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  architecture: 'Architecture',
  decisions: 'Decisions',
  patterns: 'Patterns',
  context: 'Context',
  general: 'General',
};

const IMPORTANCE_ORDER = { pinned: 0, high: 1, normal: 2, low: 3 };

export default function KnowledgeTab({ entries, projectId, userId }: KnowledgeTabProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  // Filter by category, then search, then sort by importance
  const filtered = useMemo(() => {
    let result = activeCategory === 'all'
      ? entries
      : entries.filter(e => e.category === activeCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        (e.tags && e.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Sort: pinned first, then high, normal, low
    return [...result].sort((a, b) => {
      const aOrder = IMPORTANCE_ORDER[a.importance || 'normal'] ?? 2;
      const bOrder = IMPORTANCE_ORDER[b.importance || 'normal'] ?? 2;
      return aOrder - bOrder;
    });
  }, [entries, activeCategory, searchQuery]);

  function handleCreated() {
    setShowCreate(false);
    router.refresh();
  }

  function handleEdited() {
    setEditingEntry(null);
    router.refresh();
  }

  // Category counts
  const counts: Record<string, number> = { all: entries.length };
  for (const cat of KNOWLEDGE_CATEGORIES) {
    counts[cat] = entries.filter(e => e.category === cat).length;
  }

  return (
    <div>
      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1 rounded-md text-sm border cursor-pointer transition-colors ${
            activeCategory === 'all'
              ? 'bg-accent/15 text-accent border-accent/30'
              : 'bg-surface text-muted border-[var(--border)] hover:border-accent/20'
          }`}
        >
          All ({counts.all})
        </button>
        {KNOWLEDGE_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-md text-sm border cursor-pointer capitalize transition-colors ${
              activeCategory === cat
                ? 'bg-accent/15 text-accent border-accent/30'
                : 'bg-surface text-muted border-[var(--border)] hover:border-accent/20'
            }`}
          >
            {CATEGORY_LABELS[cat]} ({counts[cat]})
          </button>
        ))}
      </div>

      {/* Search + Add entry */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge base..."
            className="w-full pl-9 pr-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
          />
        </div>
        <Button size="sm" onClick={() => { setShowCreate(true); setEditingEntry(null); }}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Entry
        </Button>
      </div>

      {/* Create form */}
      {showCreate && !editingEntry && (
        <KnowledgeForm
          projectId={projectId}
          userId={userId}
          onClose={() => setShowCreate(false)}
          onSaved={handleCreated}
        />
      )}

      {/* Edit form */}
      {editingEntry && (
        <KnowledgeForm
          projectId={projectId}
          userId={userId}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={handleEdited}
        />
      )}

      {/* Entry list */}
      <div className="space-y-2">
        {filtered.map(entry => {
          const isExpanded = expandedId === entry.id;
          return (
            <div key={entry.id} className="card-glow rounded-md bg-surface border border-[var(--border)]">
              <button
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.importance === 'pinned' && <Pin className="h-3 w-3 text-accent shrink-0" />}
                    {entry.importance === 'high' && <ArrowUp className="h-3 w-3 text-warning shrink-0" />}
                    <span className="font-display text-sm font-medium">{entry.title}</span>
                    <Badge>{CATEGORY_LABELS[entry.category]}</Badge>
                    {entry.tags && entry.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs text-muted bg-surface-light px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                  {!isExpanded && (
                    <p className="text-xs text-muted mt-1 truncate">{entry.content}</p>
                  )}
                </div>
                <span className="text-xs text-muted shrink-0">v{entry.version}</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
                  <p className="text-sm whitespace-pre-wrap mb-3">{entry.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">
                      Updated {new Date(entry.updated_at).toLocaleDateString()}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setEditingEntry(entry); setShowCreate(false); }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-6 text-center">
            <p className="text-sm text-muted">
              {activeCategory === 'all'
                ? 'No knowledge entries yet. Add your first entry or wait for agents to document their work.'
                : `No entries in ${CATEGORY_LABELS[activeCategory as KnowledgeCategory]} yet.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
