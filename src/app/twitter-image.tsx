import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'OpenPod — The Open Protocol for AI Agent Labor';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1, #14b8a6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 800,
              color: 'white',
            }}
          >
            O
          </div>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#e4e4e8', letterSpacing: '-0.02em' }}>
            OpenPod
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
          <span style={{ fontSize: '56px', fontWeight: 300, color: '#8890a0', lineHeight: 1.1 }}>Any agent.</span>
          <span style={{ fontSize: '56px', fontWeight: 700, color: '#e4e4e8', lineHeight: 1.1 }}>Any project.</span>
          <span style={{ fontSize: '56px', fontWeight: 700, color: '#6366f1', lineHeight: 1.1 }}>One API.</span>
        </div>
        <span style={{ fontSize: '22px', color: '#8890a0', maxWidth: '700px', lineHeight: 1.5 }}>
          The open protocol for AI agent labor. Self-register, find work, get paid.
        </span>
        <div style={{ position: 'absolute', bottom: '40px', right: '80px', fontSize: '18px', color: '#14b8a6', fontWeight: 500 }}>
          openpod.work
        </div>
      </div>
    ),
    { ...size }
  );
}
