'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  AuthBrandHeader,
  Button,
  Card,
  InlineAlert,
  Input,
  Label,
  LoadFailure,
  PageSkeleton,
} from '@/components/ui';
import { postLoginPath } from '@/lib/admin-routing';

export default function LoginPage() {
  const { login, loginDev, requestPasswordReset, logout, passwordRecovery, user, token, sessionLoading, profileLoading, sessionError, retrySession } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(() =>
    process.env.NODE_ENV === 'production' ? '' : 'mechanic@lightning.local',
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigationStarted = useRef(false);

  useEffect(() => {
    if (passwordRecovery) {
      window.location.replace(`/reset-password${window.location.hash}`);
      return;
    }
    if (
      !busy &&
      !error &&
      !sessionError &&
      !sessionLoading &&
      token &&
      user &&
      !profileLoading &&
      !navigationStarted.current
    ) {
      navigationStarted.current = true;
      router.replace(postLoginPath(user.role, requestedPath()), { scroll: true });
    }
  }, [passwordRecovery, busy, error, sessionError, sessionLoading, profileLoading, token, user, router]);

  if (sessionLoading || (token && !sessionError)) {
    return <PageSkeleton label="Restoring session" />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const signedInUser = await login(email, password);
      navigationStarted.current = true;
      router.replace(postLoginPath(signedInUser.role, requestedPath()), { scroll: true });
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
      const signedInUser = await loginDev(email);
      navigationStarted.current = true;
      router.replace(postLoginPath(signedInUser.role, requestedPath()), { scroll: true });
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
      {sessionError ? (
        <div className="mb-4 space-y-2">
          <LoadFailure message={sessionError} onRetry={retrySession} retryLabel="Retry session" />
          {token ? (
            <Button variant="secondary" className="w-full" onClick={() => void logout()}>
              Use another account
            </Button>
          ) : null}
        </div>
      ) : null}
      <form onSubmit={onSubmit}>
        <Card className="space-y-4">
        <div>
          <Label className="section-label" htmlFor="login-email">
            Email
          </Label>
          <Input
            id="login-email"
            className="mt-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <Label className="section-label" htmlFor="login-password">
            Password
          </Label>
          <Input
            id="login-password"
            className="mt-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error ? (
          <InlineAlert>{error}</InlineAlert>
        ) : null}
        <Button className="w-full" disabled={busy} type="submit">
          Sign In
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={onForgotPassword}
        >
          Reset password
        </Button>
        {resetSent ? (
          <p className="text-sm text-muted-foreground" role="status">
            If this email has an account, a password-reset link has been sent.
          </p>
        ) : null}
        {process.env.NODE_ENV !== 'production' ? (
          <Button
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={onDevLogin}
          >
            Dev Login (local bypass)
          </Button>
        ) : null}
        </Card>
      </form>
    </div>
  );
}

function requestedPath() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('next');
}
