import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PreferencesForm } from '../components/PreferencesForm';
import { usePreferenceOptions, useSavePreferences } from '../preferences/queries';
import { useAuth } from '../auth/useAuth';
import { ApiRequestError } from '../lib/api';

export function OnboardingPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { data: options, isPending, error: optionsError } = usePreferenceOptions();
  const savePreferences = useSavePreferences();
  const [error, setError] = useState<string | null>(null);

  if (isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-slate-400">
          Loading your options… if the server has been idle this can take up to a minute.
        </p>
      </main>
    );
  }

  if (optionsError || !options) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-loss">
          Could not load the asset list. Refresh to try again.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Welcome, {user?.name}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Three questions. They decide what your daily briefing leads with.
        </p>
      </header>

      <PreferencesForm
        options={options}
        showStarter
        submitLabel="Build my dashboard"
        submittingLabel="Saving…"
        error={error}
        onSubmit={async (payload) => {
          setError(null);
          try {
            await savePreferences.mutateAsync(payload);
            if (user) {
              setUser({ ...user, onboardingCompleted: true });
            }
            navigate('/dashboard', { replace: true });
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
