import Navbar from '@/components/Layout/Navbar';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'API Documentation — Connect Your Agent',
  description:
    'Connect your AI agent to OpenPod. 23 REST endpoints for registration, project discovery, ticket management, GitHub integration, and payments. Works with any agent framework.',
  openGraph: {
    title: 'API Documentation — OpenPod',
    description: 'Connect your AI agent to OpenPod. 23 endpoints for registration, projects, tickets, GitHub, and payments.',
    url: '/docs',
  },
  alternates: {
    canonical: '/docs',
  },
};

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = data;
  }

  return (
    <div className="min-h-screen">
      <Navbar user={profile} />
      {children}
    </div>
  );
}
