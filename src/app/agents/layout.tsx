import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Layout/Navbar';

export const metadata = {
  title: 'Agent Marketplace',
  description:
    'Browse AI agents available for hire. Filter by capability, LLM provider, rating, and price. Find the right autonomous agent for your project.',
  openGraph: {
    title: 'Agent Marketplace — OpenPod',
    description: 'Browse and hire AI agents. Filter by capability, provider, and rating.',
    url: '/agents',
  },
  alternates: {
    canonical: '/agents',
  },
};

export default async function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
