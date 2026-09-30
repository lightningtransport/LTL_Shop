'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AuthBrandHeader, Button, Card, InlineAlert, Input, Label, PageSkeleton } from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';
import { apiErrorMessage } from '@/lib/api-error-message';
import { updatePasswordSheetCopy } from '@/lib/password-change-prompt';

export default function ResetPasswordPage() {
  const { sessionLoading, token, updatePassword, logout } = useAuth();
  const { messages } = useShopLocale();
  // Same field labels and validation copy as the profile Update password sheet.
  const passwordCopy = updatePasswordSheetCopy(messages.locale);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError(passwordCopy.tooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(passwordCopy.mismatch);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      await logout();
      setComplete(true);
    } catch (err) {
      setError(apiErrorMessage(err, messages, passwordCopy.unable));
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading) return <PageSkeleton label={messages.verifyingRecoveryLink} />;

  if (complete) {
    return (
      <div>
        <AuthBrandHeader title={messages.passwordUpdatedTitle} subtitle={messages.passwordUpdatedSubtitle} />
        <Card className="space-y-4">
          <p className="text-sm text-muted-foreground" role="status">
            {messages.passwordUpdatedBody}
          </p>
          <Button asChild className="w-full"><Link href="/login">{messages.backToSignIn}</Link></Button>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div>
        <AuthBrandHeader title={messages.recoveryLinkUnavailableTitle} subtitle={messages.recoveryLinkUnavailableSubtitle} />
        <Card>
          <Button asChild className="w-full"><Link href="/login">{messages.backToSignIn}</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <AuthBrandHeader title={messages.setNewPasswordTitle} subtitle={messages.setNewPasswordSubtitle} />
      <form onSubmit={onSubmit}>
        <Card className="space-y-4">
        <div>
          <Label htmlFor="new-password">
            {passwordCopy.newPassword}
          </Label>
          <Input
            id="new-password"
            className="mt-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <Label htmlFor="confirm-password">
            {passwordCopy.confirmPassword}
          </Label>
          <Input
            id="confirm-password"
            className="mt-2"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        {error ? (
          <InlineAlert>{error}</InlineAlert>
        ) : null}
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? passwordCopy.submitting : passwordCopy.submit}
        </Button>
        </Card>
      </form>
    </div>
  );
}
