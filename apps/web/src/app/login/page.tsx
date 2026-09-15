'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  AuthBrandHeader,
  Button,
  Card,
  InlineAlert,
  LoadFailure,
  PageSkeleton,
} from '@/components/ui';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { postLoginPath } from '@/lib/admin-routing';
import { useShopLocale } from '@/lib/locale-context';
import { replaceAppLocation } from '@/lib/session-restore';

export default function LoginPage() {
  const { login, loginDev, requestPasswordReset, logout, passwordRecovery, user, token, sessionLoading, profileLoading, sessionError, retrySession } = useAuth();
  const { messages } = useShopLocale();
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
      replaceAppLocation(postLoginPath(user, requestedPath()), router, { scroll: true });
    }
  }, [passwordRecovery, busy, error, sessionError, sessionLoading, profileLoading, token, user, router]);

  const restoringSession = Boolean(
    token && !sessionError && (sessionLoading || profileLoading || !user),
  );
  if (restoringSession) {
    return <PageSkeleton label={messages.restoringSession} />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const signedInUser = await login(email, password);
      navigationStarted.current = true;
      replaceAppLocation(postLoginPath(signedInUser, requestedPath()), router, { scroll: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : (messages.locale === 'es' ? 'No se pudo iniciar sesión.' : 'Sign in failed.'));
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
      replaceAppLocation(postLoginPath(signedInUser, requestedPath()), router, { scroll: true });
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
      setError(err instanceof Error ? err.message : (messages.locale === 'es' ? 'No se pudo enviar el correo de restablecimiento.' : 'Unable to send a reset email.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AuthBrandHeader
        title={messages.signIn}
        subtitle={messages.signInHint}
      />
      {sessionError ? (
        <div className="mb-4 flex flex-col gap-2">
          <LoadFailure message={sessionError} onRetry={retrySession} retryLabel={messages.retry} />
          {token ? (
            <Button variant="secondary" className="w-full" onClick={() => void logout()}>
              {messages.locale === 'es' ? 'Usar otra cuenta' : 'Use another account'}
            </Button>
          ) : null}
        </div>
      ) : null}
      <form onSubmit={onSubmit}>
        <Card>
        <FieldGroup>
        <Field>
          <FieldLabel className="section-label" htmlFor="login-email">{messages.email}</FieldLabel>
          <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Field>
          <FieldLabel className="section-label" htmlFor="login-password">{messages.password}</FieldLabel>
          <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {error ? (
          <InlineAlert>{error}</InlineAlert>
        ) : null}
        <Button className="w-full" disabled={busy} type="submit">
          {messages.signIn}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={onForgotPassword}
        >
          {messages.resetPassword}
        </Button>
        {resetSent ? (
          <Alert variant="success" role="status">
            <AlertDescription>{messages.locale === 'es' ? 'Si este correo tiene una cuenta, se envió un enlace para restablecer la contraseña.' : 'If this email has an account, a password-reset link has been sent.'}</AlertDescription>
          </Alert>
        ) : null}
        {process.env.NODE_ENV !== 'production' ? (
          <Button
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={onDevLogin}
          >
            {messages.devLogin}
          </Button>
        ) : null}
        </FieldGroup>
        </Card>
      </form>
    </div>
  );
}

function requestedPath() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('next');
}
