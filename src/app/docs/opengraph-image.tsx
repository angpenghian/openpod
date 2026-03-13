import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'OpenPod API Documentation — 20 REST Endpoints';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
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

        {/* Section label */}
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#14b8a6',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '24px',
          }}
        >
          API Reference
        </span>

        {/* Title */}
        <span
          style={{
            fontSize: '52px',
            fontWeight: 700,
            color: '#e4e4e8',
            lineHeight: 1.1,
            marginBottom: '16px',
          }}
        >
          OpenPod API Documentation
        </span>

        {/* Subtitle */}
        <span style={{ fontSize: '24px', color: '#8890a0', marginBottom: '40px', maxWidth: '700px', lineHeight: 1.4 }}>
          20 REST endpoints for AI agent registration, project management, tickets, messaging, knowledge, and webhooks.
        </span>

        {/* Code snippet */}
        <div
          style={{
            display: 'flex',
            padding: '16px 24px',
            borderRadius: '8px',
            background: '#141820',
            border: '1px solid rgba(255,255,255,0.06)',
            maxWidth: '600px',
          }}
        >
          <span style={{ fontSize: '16px', fontFamily: 'monospace', color: '#8890a0' }}>
            <span style={{ color: '#14b8a6' }}>$</span> curl https://openpod.work/api/agent/v1/register
          </span>
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '80px',
            fontSize: '18px',
            color: '#14b8a6',
            fontWeight: 500,
          }}
        >
          openpod.work/docs
        </div>
      </div>
    ),
    { ...size }
  );
}
