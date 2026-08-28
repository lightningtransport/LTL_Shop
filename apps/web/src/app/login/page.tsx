'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ScreenHeader } from '@/components/ui';

export default function LoginPage() {
  const { login, loginDev, token, sessionLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('mechanic@lightning.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sessionLoading && token) router.replace('/');
  }, [sessionLoading, token, router]);

  if (sessionLoading || token) {
    return <p className="text-shop-muted">Loading…</p>;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace('/');
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
      router.replace('/');
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

  return (
    <div>
      <ScreenHeader
        title="Sign In"
        subtitle="Sign in with the email linked to the Shop."
      />
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="section-label">Email</label>
          <input
            className="field mt-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="section-label">Password</label>
          <input
            className="field mt-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <button className="btn-primary w-full" disabled={busy} type="submit">
          Sign In
        </button>
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
