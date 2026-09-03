'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { PageSkeleton, ScreenHeader } from '@/components/ui';

export default function ResetPasswordPage() {
  const { sessionLoading, token, updatePassword, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      await logout();
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update your password.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading) return <PageSkeleton label="Verifying recovery link" />;

  if (complete) {
    return (
      <div>
        <ScreenHeader title="Password updated" subtitle="Sign in with your new password." />
        <div className="card space-y-4">
          <p className="text-sm text-muted-foreground" role="status">
            Your password has been changed successfully.
          </p>
          <Link className="btn-primary w-full" href="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div>
        <ScreenHeader title="Recovery link unavailable" subtitle="Request a new password-reset email and try again." />
        <div className="card">
          <Link className="btn-primary w-full" href="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Set new password" subtitle="Choose a new password for your Shop account." />
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="section-label" htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            className="field mt-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="section-label" htmlFor="confirm-password">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            className="field mt-2"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        {error ? (
          <p
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
        ) : null}
        <button className="btn-primary w-full" disabled={busy} type="submit">
          {busy ? 'Updating password…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
