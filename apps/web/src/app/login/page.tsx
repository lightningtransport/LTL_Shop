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
import { useShopLocale } from '@/lib/locale-context';
import { apiErrorMessage } from '@/lib/api-error-message';
import { replaceAppLocation } from '@/lib/session-restore';
import { DEMO_HOSTED, DEMO_MODE_AVAILABLE, DEV_LOGIN_ENABLED } from '@/lib/dev-login';

/** D39: the published demo starts as the Shop Manager (MS; DEMO_MANAGER_EMAIL in lib/demo, kept out of this bundle). */
const DEMO_START_EMAIL = 'ms@lightning.local';
import { DEFAULT_DEMO_STATE, writeDemoState } from '@/lib/demo/state';
import { shopLocaleCookieWrite } from '@/lib/shop-locale';
import { LoginLoader } from '@/components/login-loader';
import { useDocumentTitle } from '@/components/admin-breadcrumb';

export default function LoginPage() {
  const { login, loginDev, requestPasswordReset, logout, passwordRecovery, user, token, sessionLoading, profileLoading, sessionError, retrySession } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const [email, setEmail] = useState(() =>
    DEV_LOGIN_ENABLED ? 'mechanic@lightning.local' : '',
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigationStarted = useRef(false);
  // LTR-293 §10: the browser tab says which screen this is.
  useDocumentTitle(messages.signIn);

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
    return <><LoginLoader label={messages.appLoading} /><PageSkeleton label={messages.restoringSession} /></>;
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
      setError(apiErrorMessage(err, messages, messages.signInFailed));
    } finally {
      setBusy(false);
    }
  }

  /**
   * D36: Dev Login plus the Demo panel (user switcher, guided stories). Local builds only. The mode is
   * turned on only after the sign-in succeeded, and an empty email is refused here (UX-7-001).
   */
  function onEnterDemoMode() {
    if (!email.trim().includes('@')) {
      setError('Type the email of a demo account first, for example manager@lightning.local.');
      return;
    }
    void onDevLogin(true);
  }

  async function onDevLogin(enterDemo = false, as = email) {
    setBusy(true);
    setError(null);
    try {
      const signedInUser = await loginDev(as);
      if (enterDemo) {
        // D39 (DP2): the demo opens on the guided flow ('FLOW', DEMO_FLOW in lib/demo/scripts: kept out of this bundle), in English (the script quotes the English labels, UX-3-008).
        writeDemoState({ ...DEFAULT_DEMO_STATE, enabled: true, panelOpen: true, welcome: true, storyId: 'FLOW' });
        document.cookie = shopLocaleCookieWrite('en');
      }
      navigationStarted.current = true;
      replaceAppLocation(postLoginPath(signedInUser, requestedPath()), router, { scroll: true });
    } catch (err) {
      setError(
        enterDemo
          ? DEMO_HOSTED
            ? 'The demo is not ready right now. Try again in a minute.'
            : 'No demo account with this email. Use one of the demo accounts.'
          : apiErrorMessage(err, messages, messages.accountNotConfigured),
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
      setError(apiErrorMessage(err, messages, messages.resetEmailFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <LoginLoader label={messages.appLoading} />
      <AuthBrandHeader
        title={DEMO_HOSTED ? 'Lightning Shop demo' : messages.signIn}
        subtitle={DEMO_HOSTED ? 'Made-up data that resets every night.' : messages.signInHint}
      />
      {sessionError ? (
        <div className="mb-4 space-y-2">
          <LoadFailure message={sessionError} onRetry={retrySession} retryLabel={messages.retry} />
          {token ? (
            <Button variant="secondary" className="w-full" onClick={() => void logout()}>
              {messages.useAnotherAccount}
            </Button>
          ) : null}
        </div>
      ) : null}
      {DEMO_HOSTED ? (
        // D39 (DP3): the published demo has no real accounts to sign in to; it starts as the Shop Manager on the flow.
        <Card className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You will follow a day at the shop through every role: the Manager, the mechanics, Safety and the Admin. Each step opens the right screen and lights up what to tap.
          </p>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <Button className="w-full" disabled={busy} onClick={() => void onDevLogin(true, DEMO_START_EMAIL)}>
            Start the demo
          </Button>
        </Card>
      ) : (
      <form onSubmit={onSubmit}>
        <Card className="space-y-4">
        <div>
          <Label htmlFor="login-email">
            {messages.email}
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
          <Label htmlFor="login-password">
            {messages.password}
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
          <p className="text-sm text-muted-foreground" role="status">
            {messages.resetEmailSent}
          </p>
        ) : null}
        {DEV_LOGIN_ENABLED ? (
          <Button
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={() => void onDevLogin()}
          >
            {messages.devLogin}
          </Button>
        ) : null}
        {DEMO_MODE_AVAILABLE ? (
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={onEnterDemoMode}
          >
            Enter demo mode (this machine only)
          </Button>
        ) : null}
        </Card>
      </form>
      )}
    </div>
  );
}

function requestedPath() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('next');
}
