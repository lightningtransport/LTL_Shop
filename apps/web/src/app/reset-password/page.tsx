'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AuthBrandHeader, Button, Card, InlineAlert, Input, Label, PageSkeleton } from '@/components/ui';

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
        <AuthBrandHeader title="Password updated" subtitle="Sign in with your new password." />
        <Card className="space-y-4">
          <p className="text-sm text-muted-foreground" role="status">
            Your password has been changed successfully.
          </p>
          <Button asChild className="w-full"><Link href="/login">Back to sign in</Link></Button>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div>
        <AuthBrandHeader title="Recovery link unavailable" subtitle="Request a new password-reset email and try again." />
        <Card>
          <Button asChild className="w-full"><Link href="/login">Back to sign in</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <AuthBrandHeader title="Set new password" subtitle="Choose a new password for your Shop account." />
      <form onSubmit={onSubmit}>
        <Card className="space-y-4">
        <div>
          <Label className="section-label" htmlFor="new-password">
            New password
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
          <Label className="section-label" htmlFor="confirm-password">
            Confirm new password
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
          {busy ? 'Updating password…' : 'Update password'}
        </Button>
        </Card>
      </form>
    </div>
  );
}
