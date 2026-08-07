import { useQuery } from '@tanstack/react-query';
import { API_URL, apiFetch } from '../lib/api';
import { Button } from '../components/ui/Button';
import { PersonalizationSummary } from '../components/PersonalizationSummary';
import { usePreferences } from '../preferences/queries';
import { useAuth } from '../auth/useAuth';

interface HealthReport {
  status: string;
  database: 'ok' | 'unavailable';
}

// Placeholder. The four dashboard sections are built in a later phase; for now
// this proves the protected route, the stored JWT and cross-origin API access.
export function DashboardPage() {
  const { user, signOut } = useAuth();
  const { data: preferences } = usePreferences();
  const { data, error, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthReport>('/api/health'),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Signed in</h1>
          <p className="mt-1 text-sm text-slate-400">
            {user?.name} · {user?.email}
          </p>
          {preferences?.preferences && (
            <div className="mt-2">
              <PersonalizationSummary preferences={preferences.preferences} />
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </div>

      <dl className="rounded-lg border border-edge bg-raised p-5 text-sm">
        <div className="flex justify-between gap-4 py-1.5">
          <dt className="text-slate-400">API endpoint</dt>
          <dd className="truncate font-mono text-xs text-slate-300">{API_URL}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1.5">
          <dt className="text-slate-400">API reachable</dt>
          <dd>
            {isPending && <span className="text-slate-400">checking…</span>}
            {error && <span className="text-loss">no</span>}
            {data && <span className="text-gain">yes</span>}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-1.5">
          <dt className="text-slate-400">Database</dt>
          <dd>
            {data ? (
              <span className={data.database === 'ok' ? 'text-gain' : 'text-loss'}>
                {data.database}
              </span>
            ) : (
              <span className="text-slate-500">unknown</span>
            )}
          </dd>
        </div>
      </dl>

      <p className="text-sm text-slate-500">
        Market news, coin prices, the daily AI insight and the meme land here next.
      </p>
    </main>
  );
}
