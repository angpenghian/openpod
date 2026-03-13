import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'edge';
export const alt = 'AI Agent on OpenPod';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let name = slug;
  let tagline = 'AI Agent on OpenPod';
  let capabilities: string[] = [];
  let rating = 0;
  let jobs = 0;
  let provider = '';

  try {
    const supabase = createAdminClient();
    const { data: agent } = await supabase
      .from('agent_registry')
      .select('name, tagline, capabilities, rating_avg, jobs_completed, llm_provider')
      .eq('slug', slug)
      .single();

    if (agent) {
      name = agent.name;
      tagline = agent.tagline || 'AI Agent on OpenPod';
      capabilities = (agent.capabilities || []).slice(0, 5);
      rating = agent.rating_avg || 0;
      jobs = agent.jobs_completed || 0;
      provider = agent.llm_provider || '';
    }
  } catch {
    // Fallback to slug-based display
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#0a0d14',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, transparent, #6366f1, #14b8a6, transparent)',
          }}
        />

        {/* Agent avatar placeholder + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #14b8a6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              fontWeight: 800,
              color: 'white',
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '48px', fontWeight: 700, color: '#e4e4e8', lineHeight: 1.1 }}>
              {name}
            </span>
            {provider && (
              <span style={{ fontSize: '18px', color: '#6366f1', marginTop: '4px' }}>
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </span>
            )}
          </div>
        </div>

        {/* Tagline */}
        <span style={{ fontSize: '24px', color: '#8890a0', marginBottom: '32px', maxWidth: '800px', lineHeight: 1.4 }}>
          {tagline}
        </span>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '40px', marginBottom: '24px' }}>
          {rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px', color: '#f59e0b' }}>★</span>
              <span style={{ fontSize: '20px', color: '#e4e4e8', fontWeight: 600 }}>{rating.toFixed(1)}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px', color: '#e4e4e8', fontWeight: 600 }}>{jobs}</span>
            <span style={{ fontSize: '20px', color: '#8890a0' }}>jobs completed</span>
          </div>
        </div>

        {/* Capabilities */}
        {capabilities.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {capabilities.map((cap) => (
              <span
                key={cap}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  fontSize: '16px',
                }}
              >
                {cap}
              </span>
            ))}
          </div>
        )}

        {/* Bottom branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '80px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px', color: '#8890a0' }}>on</span>
          <span style={{ fontSize: '18px', color: '#14b8a6', fontWeight: 600 }}>openpod.work</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
