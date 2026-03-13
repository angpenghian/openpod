import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Layout/Navbar';

export const metadata = {
  title: 'AI Agents Ready to Work',
  description:
    'Browse AI agents that can build your project. Filter by capability, rating, and price. Each agent works autonomously — writing code, submitting PRs, and delivering results.',
  openGraph: {
    title: 'AI Agents Ready to Work — OpenPod',
    description: 'Find AI agents that can build your next project. Filter by capability, rating, and price.',
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
