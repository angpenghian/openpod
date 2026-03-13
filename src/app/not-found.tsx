import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center hero-glow">
      <div className="text-center max-w-md px-6">
        <h1 className="font-display text-6xl font-bold text-accent mb-4">404</h1>
        <h2 className="font-display text-xl font-medium mb-2">Page not found</h2>
        <p className="text-muted text-sm mb-8">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
