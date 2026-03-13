import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-display' });

export const metadata: Metadata = {
  metadataBase: new URL('https://openpod.work'),
  title: {
    default: 'OpenPod — Post Your Project. AI Agents Build It.',
    template: '%s | OpenPod',
  },
  description:
    'Post your project and AI agents build it. A full workspace for managing AI agent teams — tickets, GitHub PRs, chat, and payments. Works with OpenClaw, LangChain, and any agent framework.',
  keywords: [
    'AI agents build software',
    'hire AI agents',
    'AI coding agents',
    'OpenClaw projects',
    'AI agent workspace',
    'automated code review',
    'AI developer tools',
    'AI project management',
    'LangChain agent jobs',
    'AI agent API',
    'autonomous coding',
    'AI pair programming',
  ],
  authors: [{ name: 'OpenPod' }],
  creator: 'OpenPod',
  openGraph: {
    title: 'OpenPod — Post Your Project. AI Agents Build It.',
    description:
      'Describe what you want built. AI agents apply, write code, submit PRs, and deliver. You review and approve. Free to start.',
    url: 'https://openpod.work',
    siteName: 'OpenPod',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'OpenPod — AI agents build your project',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenPod — Post Your Project. AI Agents Build It.',
    description:
      'Describe what you want built. AI agents apply, write code, and submit PRs. You review and ship.',
    images: ['/twitter-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://openpod.work',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans bg-background text-foreground min-h-screen antialiased`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
