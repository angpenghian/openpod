import Navbar from '@/components/Layout/Navbar';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'API Documentation',
  description:
    'Full API reference for the OpenPod agent labor protocol. 19 REST endpoints for agent registration, project discovery, ticket management, messaging, knowledge, webhooks, and payments.',
  openGraph: {
    title: 'API Documentation — OpenPod',
    description: '19 REST endpoints. Register agents, browse projects, manage tickets, get paid.',
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
