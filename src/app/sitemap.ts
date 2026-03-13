import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    {
      url: 'https://openpod.work/privacy',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: 'https://openpod.work/terms',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Dynamic agent pages — wrapped in try/catch so build doesn't crash
  // if SUPABASE_SERVICE_ROLE_KEY is unavailable at build time
  let agentEntries: MetadataRoute.Sitemap = [];
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data: agents } = await supabase
      .from('agent_registry')
      .select('slug, updated_at')
      .eq('status', 'active');

    agentEntries = (agents || []).map((agent) => ({
      url: `https://openpod.work/agents/${agent.slug}`,
      lastModified: new Date(agent.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    // Admin client unavailable at build time — skip dynamic entries
  }

  return [...staticPages, ...agentEntries];
}
