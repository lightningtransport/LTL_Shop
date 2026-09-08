'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AuthBrandHeader, Button, Card, InlineAlert, Input, Label, PageSkeleton } from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';

export default function ResetPasswordPage() {
  const { sessionLoading, token, updatePassword, logout } = useAuth();
  const { messages } = useShopLocale();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError(messages.locale === 'es' ? 'Usa al menos 8 caracteres para la nueva contraseña.' : 'Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError(messages.locale === 'es' ? 'Las contraseñas no coinciden.' : 'The passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      await logout();
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : (messages.locale === 'es' ? 'No se pudo actualizar la contraseña.' : 'Unable to update your password.'));
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading) return <PageSkeleton label={messages.locale === 'es' ? 'Verificando enlace de recuperación' : 'Verifying recovery link'} />;

  if (complete) {
    return (
      <div>
        <AuthBrandHeader title={messages.locale === 'es' ? 'Contraseña actualizada' : 'Password updated'} subtitle={messages.locale === 'es' ? 'Inicia sesión con tu nueva contraseña.' : 'Sign in with your new password.'} />
        <Card className="space-y-4">
          <p className="text-sm text-muted-foreground" role="status">
            {messages.locale === 'es' ? 'Tu contraseña se actualizó correctamente.' : 'Your password has been changed successfully.'}
          </p>
          <Button asChild className="w-full"><Link href="/login">{messages.locale === 'es' ? 'Volver a iniciar sesión' : 'Back to sign in'}</Link></Button>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div>
        <AuthBrandHeader title={messages.locale === 'es' ? 'Enlace de recuperación no disponible' : 'Recovery link unavailable'} subtitle={messages.locale === 'es' ? 'Solicita un nuevo correo para restablecer la contraseña e inténtalo de nuevo.' : 'Request a new password-reset email and try again.'} />
        <Card>
          <Button asChild className="w-full"><Link href="/login">{messages.locale === 'es' ? 'Volver a iniciar sesión' : 'Back to sign in'}</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <AuthBrandHeader title={messages.locale === 'es' ? 'Crear nueva contraseña' : 'Set new password'} subtitle={messages.locale === 'es' ? 'Elige una nueva contraseña para tu cuenta del Shop.' : 'Choose a new password for your Shop account.'} />
      <form onSubmit={onSubmit}>
        <Card className="space-y-4">
        <div>
          <Label className="section-label" htmlFor="new-password">
            {messages.locale === 'es' ? 'Nueva contraseña' : 'New password'}
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
            {messages.locale === 'es' ? 'Confirmar nueva contraseña' : 'Confirm new password'}
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
          {busy ? (messages.locale === 'es' ? 'Actualizando contraseña…' : 'Updating password…') : (messages.locale === 'es' ? 'Actualizar contraseña' : 'Update password')}
        </Button>
        </Card>
      </form>
    </div>
  );
}
