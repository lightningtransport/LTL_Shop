'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, Gauge, Languages, Moon, Sun, Wrench, X } from 'lucide-react';
import { AppCapability, MechanicMode } from '@ltl-shop/shared';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { useShopLocale } from '@/lib/locale-context';
import { jobStatusVariant, phaseVariant, priorityVariant, workOrderStatusVariant } from '@/lib/status-chips';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Alert, AlertAction, AlertDescription } from './ui/alert';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Empty } from './ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { NativeSelect } from './ui/native-select';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Textarea } from './ui/textarea';

export { Alert, AlertAction, AlertDescription, AlertTitle, alertVariants } from './ui/alert';
export { Badge, badgeVariants, type BadgeProps } from './ui/badge';
export { Button, buttonVariants, type ButtonProps } from './ui/button';
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';
export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from './ui/field';
export { Input } from './ui/input';
export { Label } from './ui/label';
export {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
  type NativeSelectProps,
} from './ui/native-select';
export { Separator } from './ui/separator';
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
export { Skeleton } from './ui/skeleton';
export { Textarea } from './ui/textarea';

/** @deprecated Import NativeSelect from `@/components/ui/native-select`. */
export const Select = NativeSelect;

export function InlineAlert({
  children,
  className,
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <Alert variant="destructive" className={className} aria-live="assertive">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export type MultiSelectOption = { label: string; value: string; disabled?: boolean };

export function MultiSelect({
  label,
  options,
  value,
  onValueChange,
  placeholder = 'Select options',
  className,
}: {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const { messages } = useShopLocale();
  const [open, setOpen] = React.useState(false);
  const selected = options.filter((option) => value.includes(option.value));
  const summary = selected.length === 0 ? placeholder : selected.map((option) => option.label).join(', ');

  function toggleValue(option: MultiSelectOption) {
    onValueChange(
      value.includes(option.value)
        ? value.filter((item) => item !== option.value)
        : [...value, option.value],
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-between text-left font-normal', className)}>
          <span className={selected.length === 0 ? 'text-muted-foreground' : undefined}>{summary}</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription className="sr-only">{placeholder}</DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label={`Close ${label}`}>
              <X aria-hidden="true" className="size-5" />
            </Button>
          </DialogClose>
        </div>
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <label
                key={option.value}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
                  checked ? 'border-primary bg-accent' : 'border-border hover:bg-muted',
                  option.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={option.disabled}
                  onChange={() => toggleValue(option)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded border',
                    checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
                  )}
                >
                  {checked ? <Check className="size-3.5" /> : null}
                </span>
                {option.label}
              </label>
            );
          })}
        </div>
        <Button className="mt-5 w-full" onClick={() => setOpen(false)}>
          {messages.multiSelectDone}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { messages } = useShopLocale();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full border bg-card shadow-sm"
      aria-label={isDark ? (messages.locale === 'es' ? 'Cambiar tema: usar modo claro' : 'Toggle theme: use light mode') : (messages.locale === 'es' ? 'Cambiar tema: usar modo oscuro' : 'Toggle theme: use dark mode')}
      title={isDark ? (messages.locale === 'es' ? 'Usar tema claro' : 'Use light theme') : (messages.locale === 'es' ? 'Usar tema oscuro' : 'Use dark theme')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun aria-hidden="true" className="size-5" /> : <Moon aria-hidden="true" className="size-5" />}
    </Button>
  );
}

function ProfileDialog() {
  const { user, updatePassword, logout } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  if (!user) return null;

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (newPassword.length < 8) {
      setError(messages.locale === 'es' ? 'Usa al menos 8 caracteres para la nueva contraseña.' : 'Use at least 8 characters for your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(messages.locale === 'es' ? 'Las contraseñas no coinciden.' : 'The passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setStatus(messages.locale === 'es' ? 'Contraseña actualizada.' : 'Password updated.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  async function handleLogout() {
    setError(null);
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
      router.refresh();
      window.location.replace('/login');
      setOpen(false);
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.');
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setStatus(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className="max-w-28 justify-between gap-1.5 sm:max-w-44"
          aria-label={messages.locale === 'es' ? `Abrir perfil de ${user.name}` : `Open profile for ${user.name}`}
        >
          <span className="truncate">{user.name}</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby="profile-description">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogTitle>{user.name}</DialogTitle>
            <DialogDescription id="profile-description" className="mt-1 break-words">
              {user.email}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label={messages.locale === 'es' ? 'Cerrar perfil' : 'Close profile'}>
              <X aria-hidden="true" className="size-5" />
            </Button>
          </DialogClose>
        </div>

        <form onSubmit={handlePasswordUpdate}>
          <FieldGroup>
          <Field>
            <FieldLabel htmlFor="profile-new-password">{messages.locale === 'es' ? 'Nueva contraseña' : 'New password'}</FieldLabel>
            <Input
              id="profile-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <FieldDescription>{messages.locale === 'es' ? 'Usa al menos 8 caracteres.' : 'Use at least 8 characters.'}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-confirm-password">{messages.locale === 'es' ? 'Confirmar nueva contraseña' : 'Confirm new password'}</FieldLabel>
            <Input
              id="profile-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </Field>

          {status ? <Alert variant="success" role="status"><AlertDescription>{status}</AlertDescription></Alert> : null}
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

          <Button className="w-full" type="submit" disabled={isUpdatingPassword || isLoggingOut}>
            {isUpdatingPassword ? (messages.locale === 'es' ? 'Actualizando contraseña…' : 'Updating password…') : (messages.locale === 'es' ? 'Actualizar contraseña' : 'Update password')}
          </Button>
          </FieldGroup>
        </form>

        <Separator className="my-5" />
        <div>
          <Button
            className="w-full"
            variant="destructive"
            onClick={() => void handleLogout()}
            disabled={isUpdatingPassword || isLoggingOut}
          >
            {isLoggingOut ? (messages.locale === 'es' ? 'Cerrando sesión…' : 'Signing out…') : (messages.locale === 'es' ? 'Cerrar sesión' : 'Sign out')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AppHeaderActions() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ThemeToggle />
      <ProfileDialog />
    </div>
  );
}

export function HomeTopBar({ mode }: { mode?: MechanicMode }) {
  const { messages, setLocale } = useShopLocale();
  return (
    <>
      <header
        className="mb-4 flex items-start justify-between gap-3"
        role="banner"
        aria-label={messages.locale === 'es' ? 'Controles de Inicio' : 'Home controls'}
      >
        <Image
          src="/ltl-logo.png"
          alt="Lightning Transport and Logistics"
          width={1536}
          height={894}
          priority
          className="h-auto w-[85px] object-contain sm:w-28"
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={messages.switchTo}
            onClick={() => setLocale(messages.locale === 'en' ? 'es' : 'en')}
          >
            <Languages aria-hidden="true" className="size-4" />
            {messages.locale === 'en' ? 'ES' : 'EN'}
          </Button>
          <AppHeaderActions />
        </div>
      </header>
      {mode ? <WorkspaceNav mode={mode} /> : null}
    </>
  );
}

export function WorkspaceNav({ mode }: { mode: MechanicMode }) {
  const { user } = useAuth();
  const { messages } = useShopLocale();
  if (!user) return null;
  const canAdmin = user.capabilities.includes(AppCapability.ADMIN_ACCESS);
  const canStandard = user.capabilities.includes(AppCapability.MECHANIC_STANDARD);
  const canPm = user.capabilities.includes(AppCapability.MECHANIC_PM);
  if (!canAdmin && Number(canStandard) + Number(canPm) < 2) return null;

  return (
    <nav className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label={messages.shopWorkspaces}>
      {canAdmin ? (
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/admin"><Gauge aria-hidden="true" className="size-4" />{messages.backToShopAdmin}</Link>
        </Button>
      ) : null}
      {canStandard ? (
        <Button asChild variant={mode === MechanicMode.STANDARD ? 'secondary' : 'ghost'} size="sm" className="shrink-0">
          <Link href="/mechanic/standard" aria-current={mode === MechanicMode.STANDARD ? 'page' : undefined}>
            <Wrench aria-hidden="true" className="size-4" />{messages.workspaceStandard}
          </Link>
        </Button>
      ) : null}
      {canPm ? (
        <Button asChild variant={mode === MechanicMode.PM ? 'secondary' : 'ghost'} size="sm" className="shrink-0">
          <Link href="/mechanic/pm" aria-current={mode === MechanicMode.PM ? 'page' : undefined}>
            <Wrench aria-hidden="true" className="size-4" />{messages.workspacePm}
          </Link>
        </Button>
      ) : null}
    </nav>
  );
}

export function AuthBrandHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-6">
      <Image
        src="/ltl-logo.png"
        alt="Lightning Transport and Logistics"
        width={1536}
        height={894}
        priority
        className="h-auto w-36 object-contain sm:w-40"
      />
      <div className="mt-5">
        <h1 className="font-display text-3xl font-bold tracking-wide">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-shop-muted">{subtitle}</p> : null}
      </div>
    </header>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  backHref,
  backLabel,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const { messages } = useShopLocale();
  const content = (
    <div className="min-w-0">
      {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
      <h1 className="font-display text-3xl font-bold tracking-wide">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-shop-muted">{subtitle}</p>
      ) : null}
    </div>
  );

  return (
    <header className="mb-6">
      {backHref ? (
        <div className="flex items-center gap-3">
          <Button asChild variant="secondary" size="icon" className="shrink-0 shadow-sm">
            <Link href={backHref} aria-label={backLabel ?? messages.backToHome}>
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
          </Button>
          {content}
        </div>
      ) : (
        content
      )}
    </header>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  badges,
  actions,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <p className="section-label">{eyebrow}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 font-display text-3xl font-bold tracking-wide">{title}</h1>
          {badges}
        </div>
        {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
        {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminBackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button asChild variant="ghost" className={cn('-ml-3 gap-2', className)}>
      <Link href={href}>
        <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
        <span>{children}</span>
      </Link>
    </Button>
  );
}

export function AdminFilterToolbar({
  children,
  onSubmit,
  onClear,
  clearLabel,
  applyLabel,
  className,
}: {
  children: React.ReactNode;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onClear: () => void;
  clearLabel: string;
  applyLabel: string;
  className?: string;
}) {
  return (
    <form
      role="search"
      className={cn('flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-end', className)}
      onSubmit={onSubmit}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>{clearLabel}</Button>
        <Button type="submit" size="sm">{applyLabel}</Button>
      </div>
    </form>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Empty className="gap-0 rounded-2xl border border-dashed border-shop-border px-4 py-8 text-sm text-shop-muted">
      {children}
    </Empty>
  );
}

/** Compact dashed empty for in-card or in-column slots. Use EmptyState for page/section empties. */
export function CompactEmpty({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Empty className={cn('items-stretch gap-0 whitespace-normal rounded-lg border border-dashed px-3 py-2 text-left text-pretty text-sm leading-snug text-muted-foreground', className)}>
      {children}
    </Empty>
  );
}

export function PageSkeleton({ label = 'Loading page' }: { label?: string }) {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-2/3 rounded-lg" />
        <Skeleton className="h-4 w-full" />
      </div>
      <CardListSkeleton />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LoadFailure({
  message = 'Unable to load this screen.',
  onRetry,
  retryLabel = 'Retry',
}: {
  message?: string;
  onRetry: () => void;
  retryLabel?: string;
}) {
  return (
    <Alert variant="destructive" aria-live="assertive">
      <AlertDescription>{message}</AlertDescription>
      <AlertAction>
        <Button type="button" variant="secondary" className="w-full" onClick={onRetry}>
          {retryLabel}
        </Button>
      </AlertAction>
    </Alert>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </Card>
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  returnFocusRef,
  closeLabel,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  closeLabel?: string;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const capturedFocusRef = React.useRef<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && !contentRef.current?.contains(activeElement)) {
      capturedFocusRef.current = activeElement;
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        ref={contentRef}
        onOpenAutoFocus={(event) => {
          const initialControl = contentRef.current?.querySelector<HTMLElement>(
            'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
          );
          if (!initialControl) return;
          event.preventDefault();
          window.requestAnimationFrame(() => initialControl.focus());
        }}
        onCloseAutoFocus={(event) => {
          const focusTarget = returnFocusRef?.current ?? capturedFocusRef.current;
          if (!focusTarget) return;
          event.preventDefault();
          focusTarget.focus();
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className={description ? undefined : 'sr-only'}>
              {description ?? title}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label={closeLabel ?? `Close ${title}`}>
              <X aria-hidden="true" className="size-5" />
            </Button>
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function PriorityBadge({
  priority,
  children,
}: {
  priority: string;
  children: React.ReactNode;
}) {
  return <Badge variant={priorityVariant(priority)}>{children}</Badge>;
}

export function WorkOrderStatusBadge({
  status,
  children,
}: {
  status: string;
  children: React.ReactNode;
}) {
  return <Badge variant={workOrderStatusVariant(status)}>{children}</Badge>;
}

export function JobStatusBadge({
  status,
  children,
}: {
  status: string;
  children: React.ReactNode;
}) {
  return <Badge variant={jobStatusVariant(status)}>{children}</Badge>;
}

export function PhaseBadge({
  phase,
  children,
  className,
}: {
  phase: string;
  children: React.ReactNode;
  className?: string;
}) {
  return <Badge variant={phaseVariant(phase)} className={cn('normal-case tracking-normal', className)}>{children}</Badge>;
}
