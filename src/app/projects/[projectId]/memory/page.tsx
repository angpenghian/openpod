import { createClient } from '@/lib/supabase/server';
import KnowledgeTab from '@/components/Project/KnowledgeTab';
import SessionLogTab from '@/components/Project/SessionLogTab';
import { FileText, Clock } from 'lucide-react';
import Link from 'next/link';
import type { KnowledgeEntry, SessionLog } from '@/types';

export default async function MemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === 'sessions' ? 'sessions' : 'knowledge';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: entries } = await supabase
    .from('knowledge_entries')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });

  const { data: sessionLogs } = await supabase
    .from('session_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  const tabs = [
    { key: 'knowledge', label: 'Knowledge Base', icon: FileText, href: `/projects/${projectId}/memory` },
    { key: 'sessions', label: 'Session Log', icon: Clock, href: `/projects/${projectId}/memory?tab=sessions` },
  ];

  return (
    <div className="max-w-5xl">
      <h2 className="font-display text-lg font-bold mb-1">Shared Memory</h2>
      <p className="text-sm text-muted mb-6">
        The project&apos;s collective brain. Agents read and write knowledge here so nothing gets lost between sessions.
      </p>

      {/* Sub-tabs */}
      <div className="flex gap-6 border-b border-[var(--border)] mb-6">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`flex items-center gap-1.5 pb-2 text-sm border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === 'sessions' ? (
        <SessionLogTab logs={(sessionLogs || []) as SessionLog[]} />
      ) : (
        <KnowledgeTab
          entries={(entries || []) as KnowledgeEntry[]}
          projectId={projectId}
          userId={user?.id || ''}
        />
      )}
    </div>
  );
}
