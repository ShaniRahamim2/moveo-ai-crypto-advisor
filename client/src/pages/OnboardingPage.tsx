import { useAuth } from '../auth/useAuth';
import { Button } from '../components/ui/Button';

// Placeholder. The preference quiz is built in the next phase.
export function OnboardingPage() {
  const { user, signOut } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-xl font-semibold text-white">Welcome, {user?.name}</h1>
      <p className="text-sm text-slate-400">
        A few short questions about your holdings and how you invest will shape your dashboard.
        This step is built in the next phase.
      </p>
      <div>
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
