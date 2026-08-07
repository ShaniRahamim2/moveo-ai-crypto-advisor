import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PreferencesForm } from '../components/PreferencesForm';
import { usePreferenceOptions, usePreferences, useSavePreferences } from '../preferences/queries';
import { ApiRequestError } from '../lib/api';

export function PreferencesPage() {
  const navigate = useNavigate();
  const { data: options, isPending: optionsPending } = usePreferenceOptions();
  const { data: current, isPending: preferencesPending } = usePreferences();
  const savePreferences = useSavePreferences();
  const [error, setError] = useState<string | null>(null);

  if (optionsPending || preferencesPending) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-slate-400">Loading your preferences…</p>
      </main>
    );
  }

  if (!options) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-loss">Could not load the asset list. Refresh to try again.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <header className="mb-8">
        <Link to="/dashboard" className="text-sm text-accent hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-white">Preferences</h1>
        <p className="mt-1 text-sm text-slate-400">
          Changes apply to your dashboard immediately.
        </p>
      </header>

      <PreferencesForm
        options={options}
        initial={current?.preferences ?? null}
        submitLabel="Save changes"
        submittingLabel="Saving…"
        error={error}
        onSubmit={async (payload) => {
          setError(null);
          try {
            await savePreferences.mutateAsync(payload);
            navigate('/dashboard');
          } catch (err) {
            setError(
              err instanceof ApiRequestError
                ? err.message
                : 'Could not save your preferences. Try again in a moment.',
            );
          }
        }}
      />
    </main>
  );
}
