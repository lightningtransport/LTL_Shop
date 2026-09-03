'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AuthBrandHeader, PageSkeleton } from '@/components/ui';

export default function LoginPage() {
  const { login, loginDev, requestPasswordReset, passwordRecovery, token, sessionLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(() =>
    process.env.NODE_ENV === 'production' ? '' : 'mechanic@lightning.local',
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (passwordRecovery) {
      window.location.replace(`/reset-password${window.location.hash}`);
      return;
    }
    if (!sessionLoading && token) router.replace('/', { scroll: true });
  }, [passwordRecovery, sessionLoading, token, router]);

  if (sessionLoading || token) {
    return <PageSkeleton label="Restoring session" />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace('/', { scroll: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDevLogin() {
    setBusy(true);
    setError(null);
    try {
      await loginDev(email);
      router.replace('/', { scroll: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Your account is not configured for the Shop application.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send a reset email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AuthBrandHeader
        title="Sign In"
        subtitle="Sign in with the email linked to the Shop."
      />
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="section-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="field mt-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="section-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="field mt-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error ? (
          <p
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
        ) : null}
        <button className="btn-primary w-full" disabled={busy} type="submit">
          Sign In
        </button>
        <button
          type="button"
          className="btn-secondary w-full"
          disabled={busy}
          onClick={onForgotPassword}
        >
          Reset password
        </button>
        {resetSent ? (
          <p className="text-sm text-muted-foreground" role="status">
            If this email has an account, a password-reset link has been sent.
          </p>
        ) : null}
        {process.env.NODE_ENV !== 'production' ? (
          <button
            type="button"
            className="btn-secondary w-full"
            disabled={busy}
            onClick={onDevLogin}
          >
            Dev Login (local bypass)
          </button>
        ) : null}
      </form>
    </div>
  );
}
