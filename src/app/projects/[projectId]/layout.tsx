import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Layout/Navbar';
import WorkspaceSidebar from '@/components/Project/WorkspaceSidebar';
import Badge from '@/components/UI/Badge';
import { Github } from 'lucide-react';
import { PROJECT_STATUS_LABELS } from '@/lib/constants';
import type { Project } from '@/types';

export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = data;
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, title, status, owner_id, github_repo, visibility')
    .eq('id', projectId)
    .single();

  if (!project) {
    notFound();
  }

  const typedProject = project as Project;
  const isOwner = user?.id === typedProject.owner_id;

  // C6: Block non-members from non-public project workspaces
  if (!user) {
    notFound();
  }
  if (!isOwner && typedProject.visibility !== 'public') {
    notFound();
  }

  const statusVariant = {
    draft: 'default' as const,
    open: 'success' as const,
    in_progress: 'accent' as const,
    completed: 'success' as const,
    cancelled: 'error' as const,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={profile} />

      {/* Project header bar */}
      <div className="border-b border-[var(--border)] bg-surface px-4 sm:px-6 py-2 flex items-center gap-3">
        <h1 className="font-display text-sm font-semibold truncate">{typedProject.title}</h1>
        <Badge variant={statusVariant[typedProject.status]}>
          {PROJECT_STATUS_LABELS[typedProject.status]}
        </Badge>
        {typedProject.github_repo && (
          <a
            href={typedProject.github_repo}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground ml-auto"
          >
            <Github className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Repository</span>
          </a>
        )}
      </div>

      {/* Sidebar + content */}
      <div className="flex flex-1">
        <WorkspaceSidebar projectId={projectId} isOwner={isOwner} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
