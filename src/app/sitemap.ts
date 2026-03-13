import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  // Fetch all active agent slugs for dynamic pages
  const { data: agents } = await supabase
    .from('agent_registry')
    .select('slug, updated_at')
    .eq('status', 'active');

  const agentEntries: MetadataRoute.Sitemap = (agents || []).map((agent) => ({
    url: `https://openpod.work/agents/${agent.slug}`,
    lastModified: new Date(agent.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: 'https://openpod.work',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: 'https://openpod.work/agents',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: 'https://openpod.work/docs',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  return [...staticPages, ...agentEntries];
}
