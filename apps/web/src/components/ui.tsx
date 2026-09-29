'use client';

import { MechanicTabs } from './mechanic-tabs';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Dialog as DialogPrimitive, Slot } from 'radix-ui';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, Gauge, Moon, Sun, Wrench, X } from 'lucide-react';
import { AppCapability, MechanicMode } from '@ltl-shop/shared';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { useShopLocale } from '@/lib/locale-context';
import { shouldOpenUpdatePasswordSheet, updatePasswordSheetCopy } from '@/lib/password-change-prompt';
import { profileInitials } from '@/lib/profile-initials';
import { jobStatusVariant, phaseVariant, priorityVariant, workOrderStatusVariant } from '@/lib/status-chips';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
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
        sm: 'min-h-11 px-3 py-2 text-sm [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:text-xs',
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
  <h3 ref={ref} className={cn('section-title', className)} {...props} />
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
        'rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-text',
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
  'inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
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
  <DialogPrimitive.Title ref={ref} className={cn('font-display text-xl font-bold leading-tight', className)} {...props} />
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

/** A labeled row of options where one is pressed (language, theme). Each option is a 44px target. */
function SegmentedChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="space-y-2">
      <p className="group-title">{label}</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? 'secondary' : 'outline'}
            className={cn('px-2', value === option.value && 'border-primary text-primary')}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ProfileSettings() {
  const { messages, setLocale } = useShopLocale();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const es = messages.locale === 'es';

  return (
    <div className="space-y-4">
      {/* Native names, so a person who cannot read the current language still finds theirs. */}
      <SegmentedChoice
        label={es ? 'Idioma' : 'Language'}
        value={messages.locale}
        options={[
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Español' },
        ]}
        onChange={(next) => {
          if (next === messages.locale) return;
          setLocale(next);
          // Admin copy is rendered on the server from the cookie.
          router.refresh();
        }}
      />
      <SegmentedChoice
        label={es ? 'Tema' : 'Theme'}
        value={mounted ? (theme as 'light' | 'dark' | 'system' | undefined) : undefined}
        options={[
          { value: 'light', label: es ? 'Claro' : 'Light', icon: <Sun aria-hidden="true" className="size-4" /> },
          { value: 'dark', label: es ? 'Oscuro' : 'Dark', icon: <Moon aria-hidden="true" className="size-4" /> },
          { value: 'system', label: es ? 'Auto' : 'Auto' },
        ]}
        onChange={setTheme}
      />
    </div>
  );
}

function ProfileDialog() {
  const {
    user,
    logout,
    mustChangePassword,
    passwordChangeResolved,
    dismissPasswordChange,
  } = useAuth();
  const { messages } = useShopLocale();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  // Keep the slot while the session restores so the header does not shift when the user arrives.
  if (!user) return <span aria-hidden="true" className="size-11 shrink-0" />;

  function requestProfileMenu() {
    if (shouldOpenUpdatePasswordSheet({
      policyRequiresPasswordChange: mustChangePassword,
      passwordChangeResolved,
    })) {
      setMenuOpen(false);
      setPasswordSheetOpen(true);
      return;
    }
    setPasswordSheetOpen(false);
    setMenuOpen(true);
  }

  function handlePasswordSheetOpenChange(nextOpen: boolean) {
    setPasswordSheetOpen(nextOpen);
    if (!nextOpen) dismissPasswordChange();
  }

  async function handleLogout() {
    setError(null);
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
      router.refresh();
      window.location.replace('/login');
      setMenuOpen(false);
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.');
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      {/* LTR-167: initials instead of a truncated name; the full name is in the menu. */}
      <Button
        variant="secondary"
        size="icon"
        className="shrink-0 rounded-full border-primary/30 bg-primary/10 text-sm font-bold text-primary"
        aria-label={messages.locale === 'es' ? `Abrir perfil de ${user.name}` : `Open profile for ${user.name}`}
        aria-expanded={menuOpen || passwordSheetOpen}
        aria-haspopup="dialog"
        onClick={requestProfileMenu}
      >
        <span aria-hidden="true">{profileInitials(user.name)}</span>
      </Button>
      <Dialog
        open={menuOpen}
        onOpenChange={(nextOpen) => {
          setMenuOpen(nextOpen);
          if (!nextOpen) setError(null);
        }}
      >
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

          <ProfileSettings />

          {error ? <p className="mt-4 text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}

          {/* Signing out is rare; it sits last and does not compete with the settings above. */}
          <Button
            className="mt-6 w-full text-destructive-text"
            variant="outline"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (messages.locale === 'es' ? 'Cerrando sesión…' : 'Signing out…') : (messages.locale === 'es' ? 'Cerrar sesión' : 'Sign out')}
          </Button>
        </DialogContent>
      </Dialog>
      <UpdatePasswordSheet open={passwordSheetOpen} onOpenChange={handlePasswordSheetOpenChange} />
    </>
  );
}

function UpdatePasswordSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updatePassword } = useAuth();
  const { messages } = useShopLocale();
  const copy = updatePasswordSheetCopy(messages.locale === 'es' ? 'es' : 'en');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  }, [open]);

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(copy.tooShort);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(copy.mismatch);
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(newPassword);
      onOpenChange(false);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : copy.unable);
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="update-password-description">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription id="update-password-description" className="mt-1">
              {copy.description}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label={copy.close} disabled={isUpdatingPassword}>
              <X aria-hidden="true" className="size-5" />
            </Button>
          </DialogClose>
        </div>

        <form className="space-y-4" onSubmit={handlePasswordUpdate}>
          <div className="space-y-2">
            <Label htmlFor="profile-new-password">{copy.newPassword}</Label>
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
            <Label htmlFor="profile-confirm-password">{copy.confirmPassword}</Label>
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

          <p className="text-sm text-muted-foreground">{copy.hint}</p>
          {error ? <p className="text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}

          <Button className="w-full" type="submit" disabled={isUpdatingPassword}>
            {isUpdatingPassword ? copy.submitting : copy.submit}
          </Button>
          <Button
            className="w-full"
            type="button"
            variant="outline"
            disabled={isUpdatingPassword}
            onClick={() => onOpenChange(false)}
          >
            {copy.dismiss}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** LTR-167: the header holds only the profile button; language and theme live in its menu. */
export function AppHeaderActions() {
  return <ProfileDialog />;
}

export function HomeTopBar({ mode }: { mode?: MechanicMode }) {
  const { messages } = useShopLocale();
  return (
    <>
      <header
        className="app-topbar"
        role="banner"
        aria-label={messages.locale === 'es' ? 'Controles de Inicio' : 'Home controls'}
      >
        <div className="app-topbar-row">
          <Image
            src="/ltl-logo.png"
            alt="Lightning Transport and Logistics"
            width={1536}
            height={894}
            priority
            className="h-10 w-auto object-contain"
          />
          <AppHeaderActions />
        </div>
      </header>
      {mode ? <WorkspaceNav mode={mode} /> : null}
      {mode ? <MechanicTabs mode={mode} /> : null}
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
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
    </header>
  );
}

/**
 * LTR-166: the one page header for mechanic, auth-adjacent, and Admin screens. Title, an optional one-line
 * subtitle, optional meta (updated at), badges beside the title, and actions. No eyebrow above the title.
 * It has no outer margin: the page stack sets the gap below it (`space-y-6`, or `mb-6` outside a stack).
 */
export function PageHeader({
  title,
  subtitle,
  meta,
  badges,
  actions,
  backHref,
  backLabel,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  /** Icon back button beside the title (mechanic screens). Admin screens use AdminBackLink above instead. */
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  const { messages } = useShopLocale();
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {backHref ? (
          <Button asChild variant="secondary" size="icon" className="shrink-0 shadow-sm">
            <Link href={backHref} aria-label={backLabel ?? messages.backToHome}>
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="page-title min-w-0">{title}</h1>
            {badges}
          </div>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
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

/**
 * LTR-168: a folded section with one surface. The title is a real heading inside the summary, so the page
 * outline stays intact while it is closed. Inside, separate blocks with `SectionBlock`, never another Card.
 */
export function CollapsibleSection({
  title,
  description,
  children,
  defaultOpen = false,
  testId,
  className,
  ...props
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDetailsElement>, 'title'>) {
  return (
    <details
      className={cn('group rounded-xl border bg-card text-card-foreground shadow-soft', className)}
      data-testid={testId}
      open={defaultOpen || undefined}
      {...props}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <h2 className="section-title">{title}</h2>
          {description ? <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span> : null}
        </span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="divide-y border-t">{children}</div>
    </details>
  );
}

/** One block inside a Card or CollapsibleSection: a group title and its content, separated by a divider. */
export function SectionBlock({
  title,
  description,
  children,
  className,
  ...props
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section className={cn('space-y-3 p-4', className)} {...props}>
      {title ? (
        <div>
          <h3 className="group-title">{title}</h3>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
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
  return (
    <div className={cn('whitespace-normal text-pretty rounded-lg border border-dashed px-3 py-2 text-sm leading-snug text-muted-foreground', className)}>
      {children}
    </div>
  );
}

/**
 * Full-page wait. `header={false}` when the real PageHeader is already on screen above it, so the title
 * does not appear twice and nothing shifts when the data arrives (LTR-167).
 */
export function PageSkeleton({ label = 'Loading page', header = true }: { label?: string; header?: boolean }) {
  return (
    <div
      className="animate-pulse space-y-6"
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      {header ? (
        <div className="space-y-2">
          <div className="h-8 w-2/3 rounded-lg bg-shop-panel" />
          <div className="h-4 w-full rounded bg-shop-panel" />
        </div>
      ) : null}
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
      className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-text"
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
            <Button variant="ghost" size="icon" aria-label={closeLabel ?? 'Close'}>
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
  return <Badge variant={phaseVariant(phase)} className={className}>{children}</Badge>;
}
