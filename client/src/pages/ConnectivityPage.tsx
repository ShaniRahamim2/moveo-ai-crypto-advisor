import { useQuery } from '@tanstack/react-query';
import { API_URL, apiFetch } from '../lib/api';

interface HealthReport {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  database: 'ok' | 'unavailable';
}

// Placeholder route for the deployment skeleton. It exists so the live frontend
// proves it can reach the live API across origins before any feature is built,
// and it is replaced by the real routes in a later phase.
export function ConnectivityPage() {
  const { data, error, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthReport>('/api/health'),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 text-slate-200">
      <div>
        <h1 className="text-2xl font-semibold text-white">Crypto Advisor</h1>
        <p className="mt-1 text-sm text-slate-400">Deployment skeleton</p>
      </div>

      <dl className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-5 text-sm">
        <div className="flex justify-between gap-4 py-1.5">
          <dt className="text-slate-400">API endpoint</dt>
          <dd className="truncate font-mono text-xs text-slate-300">{API_URL}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1.5">
          <dt className="text-slate-400">API reachable</dt>
          <dd>
            {isPending && <span className="text-slate-400">checking…</span>}
            {error && <span className="text-[var(--color-loss)]">no</span>}
            {data && <span className="text-[var(--color-gain)]">yes</span>}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-1.5">
          <dt className="text-slate-400">Database</dt>
          <dd>
            {data ? (
              <span
                className={
                  data.database === 'ok'
                    ? 'text-[var(--color-gain)]'
                    : 'text-[var(--color-loss)]'
                }
              >
                {data.database}
              </span>
            ) : (
              <span className="text-slate-500">unknown</span>
            )}
          </dd>
        </div>
      </dl>

      {error && (
        <p className="text-sm text-slate-400">
          The API did not respond. If the backend has been idle it may be waking up, which can
          take up to a minute on the free tier.
        </p>
      )}
    </main>
  );
}
