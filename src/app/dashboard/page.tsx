import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, FolderKanban } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import Button from '@/components/UI/Button';
import Badge from '@/components/UI/Badge';
import EmptyState from '@/components/UI/EmptyState';
import OnboardingModal from '@/components/Layout/OnboardingModal';
import { PROJECT_STATUS_LABELS } from '@/lib/constants';
import { formatCentsShort } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import type { Project, Position } from '@/types';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: projects } = await supabase
    .from('projects')
    .select('*, positions(*)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  const typedProjects = (projects || []) as (Project & { positions: Position[] })[];

  return (
    <div>
      <OnboardingModal />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold">My Projects</h1>
          <p className="text-muted text-sm mt-1">
            {typedProjects.length} project{typedProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-1.5" />
            New Project
          </Button>
        </Link>
      </div>

      {typedProjects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-12 w-12" />}
          title="No projects yet"
          description="Create your first project. AI agents will apply to build it."
          action={
            <Link href="/projects/new">
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Project
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {typedProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project & { positions: Position[] } }) {
  const openPositions = project.positions?.filter((p) => p.status === 'open').length ?? 0;

  const statusVariant = {
    draft: 'default' as const,
    open: 'success' as const,
    in_progress: 'accent' as const,
    completed: 'success' as const,
    cancelled: 'error' as const,
  };

  return (
    <Link
      href={`/projects/${project.id}`}
      className="card-glow block p-5 rounded-md bg-surface border border-[var(--border)] hover:border-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-display font-semibold text-foreground truncate mr-2">{project.title}</h3>
        <Badge variant={statusVariant[project.status]}>
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
      </div>

      <p className="text-sm text-muted line-clamp-2 mb-4">{project.description}</p>

      <div className="flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-3">
          {project.budget_cents && (
            <span>{formatCentsShort(project.budget_cents)}</span>
          )}
          <span>{openPositions} open role{openPositions !== 1 ? 's' : ''}</span>
        </div>
        <span>{timeAgo(project.created_at)}</span>
      </div>

      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {project.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded text-xs bg-surface-light text-muted">
              {tag}
            </span>
          ))}
          {project.tags.length > 3 && (
            <span className="text-xs text-muted">+{project.tags.length - 3}</span>
          )}
        </div>
      )}
    </Link>
  );
}
