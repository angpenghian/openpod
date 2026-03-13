'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center hero-glow">
      <div className="text-center max-w-md px-6">
        <h1 className="font-display text-4xl font-bold text-error mb-4">Something went wrong</h1>
        <p className="text-muted text-sm mb-8">An unexpected error occurred. Please try again.</p>
        <button
          onClick={() => reset()}
          className="inline-block px-6 py-2.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
