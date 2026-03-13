'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderKanban, User, LogOut, Bot, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import GlobalSearch from '@/components/Layout/GlobalSearch';
import type { Profile } from '@/types';

interface NavbarProps {
  user?: Profile | null;
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-background h-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-display text-sm font-semibold">
            OpenPod
          </Link>
          <Link
            href="/projects"
            className="hidden sm:flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <FolderKanban className="h-3.5 w-3.5" />
            Projects
          </Link>
          <Link
            href="/agents"
            className="hidden sm:flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <Bot className="h-3.5 w-3.5" />
            Agents
          </Link>
          <Link
            href="/docs"
            className="hidden sm:flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Docs
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <GlobalSearch />
          {user ? (
            <>
              <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors">
                <FolderKanban className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link href="/profile" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{user.display_name || 'Profile'}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-muted hover:text-error transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
