import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { PasswordField } from '../components/ui/PasswordField';
import { useAuth } from '../auth/useAuth';
import { ApiRequestError } from '../lib/api';

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      await signUp(form);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError && err.details?.length) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
      } else {
        setError(
          err instanceof ApiRequestError
            ? err.message
            : 'Could not reach the server. It may be waking up — try again in a moment.',
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Two minutes to a dashboard built around your holdings."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Name"
          autoComplete="name"
          required
          value={form.name}
          onChange={update('name')}
          error={fieldErrors.name}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
          hint="At least 8 characters."
        />

        {error && (
          <p role="alert" className="text-sm text-loss">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}
