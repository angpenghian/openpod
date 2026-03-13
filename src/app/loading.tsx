export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-muted text-sm">Loading...</span>
      </div>
    </div>
  );
}
