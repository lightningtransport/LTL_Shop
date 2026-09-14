'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Dialog as DialogPrimitive, Slot } from 'radix-ui';
import { ArrowLeft, Check, ChevronDown, Gauge, Languages, Moon, Sun, Wrench, X } from 'lucide-react';
import { AppCapability, MechanicMode } from '@ltl-shop/shared';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { useShopLocale } from '@/lib/locale-context';
import { jobStatusVariant, phaseVariant, priorityVariant, workOrderStatusVariant } from '@/lib/status-chips';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        secondary: 'border bg-card text-card-foreground hover:bg-accent',
        outline: 'border bg-background text-foreground hover:bg-accent',
        ghost: 'text-foreground hover:bg-accent',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
      },
      size: {
        default: 'min-h-11',
        sm: 'min-h-9 px-3 py-2 text-xs',
        lg: 'min-h-12 px-5 py-3 text-base',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';

    return (
      <Comp
        ref={ref}
        {...(!asChild ? { type } : {})}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn('field', className)}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn('field min-h-28 resize-y', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium text-foreground', className)} {...props} />
));
Label.displayName = 'Label';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative w-full min-w-0">
    <select
      ref={ref}
      className={cn('field appearance-none pr-11', className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
    />
  </div>
));
Select.displayName = 'Select';

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => <div ref={ref} className={cn('card', className)} {...props} />);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => <div ref={ref} className={cn('mb-4 space-y-1.5', className)} {...props} />);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('font-display text-lg font-semibold tracking-wide', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => <div ref={ref} className={cn('mt-4 flex items-center', className)} {...props} />);
CardFooter.displayName = 'CardFooter';

export function InlineAlert({
  children,
  className,
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className,
      )}
      role="alert"
      aria-live="assertive"
    >
      {children}
    </p>
  );
}

const badgeVariants = cva(
  'inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground',
        secondary: 'border-border bg-muted text-muted-foreground',
        outline: 'border-border text-foreground',
        destructive: 'border-destructive bg-destructive text-destructive-foreground',
        success: 'border-shop-success/40 bg-shop-success/15 text-shop-success',
        warning: 'border-shop-accent/40 bg-shop-accent/15 text-shop-accent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 max-h-[calc(100dvh-1rem-var(--app-safe-top)-var(--app-safe-bottom))] overflow-y-auto rounded-t-xl border bg-popover p-5 pb-[calc(1.25rem+var(--app-safe-bottom))] text-popover-foreground shadow-xl focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-5',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('font-display text-2xl font-bold tracking-wide', className)} {...props} />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';

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
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline" className={cn('w-full justify-between text-left font-normal', className)}>
          <span className={selected.length === 0 ? 'text-muted-foreground' : undefined}>{summary}</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogContent aria-describedby={undefined}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <DialogTitle>{label}</DialogTitle>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon" aria-label={`Close ${label}`}>
              <X aria-hidden="true" className="size-5" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        <div className="space-y-2">
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
    </DialogPrimitive.Root>
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
          size="sm"
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

        <form className="space-y-4" onSubmit={handlePasswordUpdate}>
          <div className="space-y-2">
            <Label htmlFor="profile-new-password">{messages.locale === 'es' ? 'Nueva contraseña' : 'New password'}</Label>
            <Input
              id="profile-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-confirm-password">{messages.locale === 'es' ? 'Confirmar nueva contraseña' : 'Confirm new password'}</Label>
            <Input
              id="profile-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          <p className="text-sm text-muted-foreground">{messages.locale === 'es' ? 'Usa al menos 8 caracteres.' : 'Use at least 8 characters.'}</p>
          {status ? <p className="text-sm font-medium text-shop-success" role="status">{status}</p> : null}
          {error ? <p className="text-sm font-medium text-destructive" role="alert">{error}</p> : null}

          <Button className="w-full" type="submit" disabled={isUpdatingPassword || isLoggingOut}>
            {isUpdatingPassword ? (messages.locale === 'es' ? 'Actualizando contraseña…' : 'Updating password…') : (messages.locale === 'es' ? 'Actualizar contraseña' : 'Update password')}
          </Button>
        </form>

        <div className="mt-5 border-t pt-5">
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

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-shop-border px-4 py-8 text-center text-sm text-shop-muted">
      {children}
    </div>
  );
}

/** Compact dashed empty for in-card or in-column slots. Use EmptyState for page/section empties. */
export function CompactEmpty({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground', className)}>{children}</div>;
}

export function PageSkeleton({ label = 'Loading page' }: { label?: string }) {
  return (
    <div
      className="animate-pulse space-y-6"
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-shop-border" />
        <div className="h-9 w-2/3 rounded-lg bg-shop-panel" />
        <div className="h-4 w-full rounded bg-shop-panel" />
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
    <div
      className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
      role="alert"
      aria-live="assertive"
    >
      <p>{message}</p>
      <Button type="button" variant="secondary" className="mt-3 w-full" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card space-y-3">
          <div className="h-5 w-1/3 rounded bg-shop-border" />
          <div className="h-4 w-3/4 rounded bg-shop-border/70" />
          <div className="h-10 w-full rounded-xl bg-shop-border/60" />
        </div>
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  returnFocusRef,
  closeLabel,
}: {
  open: boolean;
  title: string;
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
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        ref={contentRef}
        aria-describedby={undefined}
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
        <div className="mb-4 flex items-center justify-between">
          <DialogTitle>{title}</DialogTitle>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon" aria-label={closeLabel ?? `Close ${title}`}>
              <X aria-hidden="true" className="size-5" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogContent>
    </DialogPrimitive.Root>
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
