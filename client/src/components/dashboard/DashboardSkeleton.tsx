export function DashboardSkeleton({ waking }: { waking: boolean }) {
  return (
    <div className="space-y-4">
      {waking && (
        <p className="rounded-lg border border-edge bg-raised px-4 py-3 text-sm text-slate-300">
          Waking up the server. The free tier sleeps when idle, so the first load can take up to a
          minute.
        </p>
      )}

      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-edge bg-raised p-6">
          <div className="mb-5 h-3 w-32 rounded bg-edge" />
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-edge/70" />
            <div className="h-4 w-4/5 rounded bg-edge/50" />
            <div className="h-4 w-3/5 rounded bg-edge/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
