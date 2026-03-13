'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Ticket, MessageSquare, Brain, DollarSign, Users, Settings } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '' },
  { id: 'tickets', label: 'Tickets', icon: Ticket, path: '/tickets' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
  { id: 'memory', label: 'Memory', icon: Brain, path: '/memory' },
  { id: 'payments', label: 'Payments', icon: DollarSign, path: '/payments' },
  { id: 'team', label: 'Team', icon: Users, path: '/team' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
] as const;

export default function WorkspaceSidebar({ projectId, isOwner }: { projectId: string; isOwner: boolean }) {
  const pathname = usePathname();
  const basePath = `/projects/${projectId}`;

  function isActive(tabPath: string) {
    if (tabPath === '') {
      return pathname === basePath || pathname === basePath + '/';
    }
    return pathname.startsWith(basePath + tabPath);
  }

  const visibleTabs = isOwner ? TABS : TABS.filter(t => t.id !== 'settings' && t.id !== 'payments');

  return (
    <nav className="w-14 sm:w-48 shrink-0 border-r border-[var(--border)] bg-surface min-h-[calc(100vh-3rem)]">
      <div className="py-3 space-y-0.5">
        {visibleTabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.id}
              href={basePath + tab.path}
              className={`flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:text-foreground hover:bg-surface-light'
              }`}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline font-display">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
