'use client';

import { MechanicTabs } from './mechanic-tabs';
import { MechanicClockStrip } from './mechanic-clock-strip';
import { OfflineStrip } from './offline-strip';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Dialog as DialogPrimitive, Slot } from 'radix-ui';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, Gauge, Moon, SlidersHorizontal, Sun, Wrench, X } from 'lucide-react';
import { AppCapability, MechanicMode } from '@ltl-shop/shared';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import { DEMO_MODE_AVAILABLE } from '@/lib/dev-login';
import { DemoHeaderButton, DemoModeMenuRow } from './demo-panel';
import { useShopLocale } from '@/lib/locale-context';
import { shouldTakeInitialFocus } from '@/lib/modal-initial-focus';
import { shouldOpenUpdatePasswordSheet, updatePasswordSheetCopy } from '@/lib/password-change-prompt';
import { profileInitials } from '@/lib/profile-initials';
import { apiErrorMessage } from '@/lib/api-error-message';
import { jobStatusVariant, phaseVariant, priorityVariant, workOrderStatusVariant } from '@/lib/status-chips';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  // LTR-169: one disabled look for every variant (muted fill, muted text: 5.5:1 in light and dark), instead of a
  // faded copy of each variant that read as "washed-out blue" next to "grey" and was unreadable in dark mode.
  // Stage 8 (mockups): rounded-md, medium weight, 44px on touch and 36px with a mouse (the mockups' h-11 sm:h-9,
  // but by pointer so a touch tablet keeps 44px, LTR-167).
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors [@media(pointer:fine)]:min-h-9 disabled:pointer-events-none disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        secondary: 'border bg-card text-card-foreground hover:bg-accent',
        outline: 'border bg-background text-foreground hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
      },
      size: {
        default: '',
        sm: 'px-2.5 [@media(pointer:fine)]:min-h-8',
        lg: 'min-h-12 px-5 text-base',
        icon: 'size-11 min-h-0 p-0 [@media(pointer:fine)]:size-9 [&_svg]:size-5',
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
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      {...props}
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

// Stage 8 (F2, mockups): tinted chips, never a solid fill; warning is amber (it used to be `shop-accent`, a blue).
const badgeVariants = cva(
  'inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        // UX-2-002: `primary-text` keeps "In progress", "New", "Yours" at AA on the blue tint.
        default: 'border-primary/30 bg-primary/10 text-primary-text',
        secondary: 'border-border bg-muted text-muted-foreground',
        outline: 'border-border text-muted-foreground',
        destructive: 'border-destructive/50 bg-destructive/20 text-destructive-text',
        success: 'border-success/40 bg-success/10 text-success',
        warning: 'border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const BADGE_DOT: Record<NonNullable<VariantProps<typeof badgeVariants>['variant']>, string> = {
  default: 'bg-primary',
  secondary: 'bg-muted-foreground',
  outline: 'bg-muted-foreground',
  destructive: 'bg-destructive-text',
  success: 'bg-success',
  warning: 'bg-warning',
};

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants> & {
  /** A leading status dot (the mockups' state chips). */
  dot?: boolean;
};

export function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', BADGE_DOT[variant ?? 'default'])} /> : null}
      {children}
    </div>
  );
}

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Stage 8 (F3): a bottom sheet on phones, a centered 480px card from `sm`; the card color, not the page's.
        'anim-sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[calc(100dvh-1rem-var(--app-safe-top)-var(--app-safe-bottom))] overflow-y-auto rounded-t-2xl border bg-card p-5 pb-[calc(1.25rem+var(--app-safe-bottom))] text-card-foreground shadow-2xl focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-5 sm:[animation-name:shop-pop-in]',
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
  <DialogPrimitive.Title ref={ref} className={cn('text-base font-semibold leading-snug', className)} {...props} />
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
                  // UX-2-013: the real checkbox is sr-only, so the label shows the keyboard focus.
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
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
                    // UX-2-001: an unchecked box needs the field border (3:1), not the separator one.
                    checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
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
  return (
    <div className="space-y-4">
      {/* Native names, so a person who cannot read the current language still finds theirs. */}
      <SegmentedChoice
        label={messages.language}
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
        label={messages.theme}
        value={mounted ? (theme as 'light' | 'dark' | 'system' | undefined) : undefined}
        options={[
          { value: 'light', label: messages.themeLight, icon: <Sun aria-hidden="true" className="size-4" /> },
          { value: 'dark', label: messages.themeDark, icon: <Moon aria-hidden="true" className="size-4" /> },
          { value: 'system', label: messages.themeAuto },
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

  // LTR-179 (U6): the menu always opens (language, theme, sign out stay reachable); a pending
  // password change is a banner inside it that opens the sheet on tap.
  const passwordChangePending = shouldOpenUpdatePasswordSheet({
    policyRequiresPasswordChange: mustChangePassword,
    passwordChangeResolved,
  });
  const passwordCopy = updatePasswordSheetCopy(messages.locale);

  function requestProfileMenu() {
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
      setError(apiErrorMessage(logoutError, messages, messages.signOutFailed));
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
        aria-label={messages.openProfileFor(user.name)}
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
              <Button variant="ghost" size="icon" aria-label={messages.closeProfile}>
                <X aria-hidden="true" className="size-5" />
              </Button>
            </DialogClose>
          </div>

          {passwordChangePending ? (
            <div className="mb-5 rounded-xl border border-warning bg-warning-surface px-3 py-3 text-sm text-warning-foreground" role="status">
              <p>{passwordCopy.description}</p>
              <Button className="mt-3 w-full" onClick={() => { setMenuOpen(false); setPasswordSheetOpen(true); }}>
                {passwordCopy.title}
              </Button>
            </div>
          ) : null}

          <ProfileSettings />

          {error ? <p className="mt-4 text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}

          {/* D36: local builds can turn the Demo panel on and off from here (UX-1-001). */}
          {DEMO_MODE_AVAILABLE ? <DemoModeMenuRow onNavigate={() => setMenuOpen(false)} /> : null}

          {/* Signing out is rare; it sits last and does not compete with the settings above. */}
          <Button
            className="mt-6 w-full text-destructive-text"
            variant="outline"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? messages.signingOut : messages.signOut}
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
  const copy = updatePasswordSheetCopy(messages.locale);
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
      setError(apiErrorMessage(updateError, messages, copy.unable));
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

/**
 * LTR-167: the header holds only the profile button; language and theme live in its menu.
 * D36: in a local build with demo mode on, the Demo button sits to its left (both shells use this slot).
 */
export function AppHeaderActions() {
  return (
    <>
      {DEMO_MODE_AVAILABLE ? <DemoHeaderButton /> : null}
      <ProfileDialog />
    </>
  );
}

export function HomeTopBar({ mode }: { mode?: MechanicMode }) {
  const { messages } = useShopLocale();
  return (
    <>
      <header
        className="app-topbar"
        role="banner"
        aria-label={messages.homeControls}
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
      {/* Stage MG-2 (MG1): where my clock runs, on every General mechanic screen. */}
      {mode === MechanicMode.STANDARD ? <MechanicClockStrip /> : null}
      {mode === MechanicMode.PM ? <OfflineStrip message={messages.offlineKeptOnPhone} /> : null}
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
    <Button asChild variant="ghost" className={cn('-ml-3 gap-2 self-start', className)}>
      <Link href={href}>
        <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
        <span>{children}</span>
      </Link>
    </Button>
  );
}

/**
 * LTR-169: the Admin list filter bar, the same shape as Work Orders and Yard. A search field, then:
 * - with extra `filters`: inline when the card itself is at least 56rem wide; narrower (phones, tablets, a
 *   window beside the sidebar) a "Filters" button (with the active count) opens a sheet holding the fields and
 *   Clear / Apply. UX-4-001: decided by a container query on the card, not the window, so the search never
 *   collapses next to the sidebar (Tailwind 3 arbitrary `@container` variant, no plugin);
 * - search only: Apply next to the field (Enter also applies), Clear from `md`.
 */
export function AdminFilterToolbar({
  search,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  filters,
  activeFilterCount = 0,
  onSubmit,
  onClear,
  clearLabel,
  applyLabel,
  filtersLabel,
  closeLabel,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  /** Accessible name of the search field (and its placeholder unless `searchPlaceholder` is given). */
  searchLabel: string;
  /** UX-4-006: a short visible placeholder when `searchLabel` is too long to fit. */
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  activeFilterCount?: number;
  onSubmit: () => void;
  onClear: () => void;
  clearLabel: string;
  applyLabel: string;
  filtersLabel: string;
  closeLabel?: string;
  className?: string;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const filtersButtonRef = React.useRef<HTMLButtonElement>(null);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSheetOpen(false);
    onSubmit();
  };
  const clear = () => {
    setSheetOpen(false);
    onClear();
  };
  const actions = (
    <>
      <Button type="button" variant="ghost" className="shrink-0" onClick={clear}>{clearLabel}</Button>
      <Button type="submit" className="shrink-0">{applyLabel}</Button>
    </>
  );

  return (
    <Card className={cn('min-w-0 p-3 [container-type:inline-size]', className)}>
      <form role="search" className="flex min-w-0 items-end gap-2" onSubmit={submit}>
        {/* UX-4-001: the search keeps 14rem once there is room for it; on the phone it takes what is left. */}
        <Input
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          className="min-w-0 flex-1 sm:min-w-[14rem] sm:flex-[1_1_16rem]"
          aria-label={searchLabel}
          placeholder={searchPlaceholder ?? searchLabel}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {filters ? (
          <>
            <div className="hidden min-w-0 items-end gap-2 [@container(min-width:56rem)]:flex">{filters}{actions}</div>
            <Button
              ref={filtersButtonRef}
              type="button"
              variant="outline"
              className="shrink-0 [@container(min-width:56rem)]:hidden"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              {filtersLabel}
              {activeFilterCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </>
        ) : (
          <>
            {/* LTR-179 (U3): on the phone, Clear appears once there is something to clear. */}
            <Button type="button" variant="ghost" className={cn('shrink-0', !search && !activeFilterCount && 'hidden md:inline-flex')} onClick={clear}>{clearLabel}</Button>
            <Button type="submit" className="shrink-0">{applyLabel}</Button>
          </>
        )}
      </form>
      {filters ? (
        <Modal open={sheetOpen} title={filtersLabel} closeLabel={closeLabel} onClose={() => setSheetOpen(false)} returnFocusRef={filtersButtonRef}>
          <form className="space-y-4" onSubmit={submit}>
            {filters}
            <div className="flex justify-end gap-2 border-t pt-4">{actions}</div>
          </form>
        </Modal>
      ) : null}
    </Card>
  );
}

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  /** The row's title on phones: first, larger, without its label. Exactly one column should set it. */
  primary?: boolean;
  /** Secondary data left out of the phone card (still in the table from `md`). */
  hideOnMobile?: boolean;
  /** Extra classes for the cell (desktop), e.g. `whitespace-nowrap`. */
  className?: string;
  testId?: string;
  /** TL-8: leave this row's cell out of the phone card when it has nothing to say (no "Label —" lines). */
  emptyOnMobile?: (item: T) => boolean;
};

/**
 * LTR-169: the one Admin table. A real table from `md`; on phones each row is a card with the primary column
 * as its title and every other column as "label: value", so no column falls off screen. One DOM for both,
 * with explicit ARIA roles, because `display: block` on table elements drops their semantics in Safari.
 * Order columns by importance: it is the order on phones too.
 */
export function DataTable<T>({
  items,
  columns,
  getKey,
  caption,
  getRowLabel,
  className,
}: {
  items: T[];
  columns: DataTableColumn<T>[];
  getKey: (item: T) => string;
  /** Screen-reader name of the table. */
  caption: string;
  /** Accessible name of each row (defaults to the primary column's text). */
  getRowLabel?: (item: T) => string;
  className?: string;
}) {
  return (
    <div className={cn('md:overflow-x-auto md:rounded-xl md:border', className)}>
      <table role="table" className="w-full text-left text-sm max-md:block">
        <caption className="sr-only">{caption}</caption>
        <thead role="rowgroup" className="bg-muted/50 text-muted-foreground max-md:hidden">
          <tr role="row">
            {columns.map((column) => (
              <th key={column.key} role="columnheader" scope="col" className="p-3 font-medium">{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="max-md:block max-md:space-y-3">
          {items.map((item) => (
            <tr
              key={getKey(item)}
              role="row"
              aria-label={getRowLabel?.(item)}
              className="md:border-t max-md:block max-md:rounded-xl max-md:border max-md:bg-card max-md:p-4 max-md:shadow-soft"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  role="cell"
                  data-label={column.header}
                  data-testid={column.testId}
                  className={cn(
                    'p-3 align-top',
                    'max-md:flex max-md:min-w-0 max-md:items-start max-md:justify-between max-md:gap-3 max-md:px-0 max-md:py-1.5',
                    column.primary
                      ? 'max-md:pb-2 max-md:pt-0 max-md:text-base'
                      : 'max-md:border-t max-md:text-right max-md:before:shrink-0 max-md:before:text-left max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)] max-md:[&>*]:min-w-0',
                    column.hideOnMobile && 'max-md:hidden',
                    column.emptyOnMobile?.(item) && 'max-md:hidden',
                    column.className,
                  )}
                >
                  {column.cell(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  description,
  dismissible = true,
  className,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  closeLabel?: string;
  /** Stage 8 (mockups): one line under the title, in the dialog's header. */
  description?: React.ReactNode;
  /** ME3: false while closing would lose something (typed fields, a password shown once): Esc and a click outside do nothing; X and the dialog's buttons still close. */
  dismissible?: boolean;
  /** A wider dialog for a long form (New purchase). */
  className?: string;
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
        className={className}
        {...(description ? {} : { 'aria-describedby': undefined })}
        onEscapeKeyDown={(event) => { if (!dismissible) event.preventDefault(); }}
        onInteractOutside={(event) => { if (!dismissible) event.preventDefault(); }}
        onOpenAutoFocus={(event) => {
          const initialControl = contentRef.current?.querySelector<HTMLElement>(
            'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
          );
          if (!initialControl) return;
          event.preventDefault();
          // R10: not when someone already moved into another field of the dialog (their typing would land here).
          window.requestAnimationFrame(() => {
            if (shouldTakeInitialFocus(contentRef.current, document.activeElement)) initialControl.focus();
          });
        }}
        onCloseAutoFocus={(event) => {
          const focusTarget = returnFocusRef?.current ?? capturedFocusRef.current;
          if (!focusTarget) return;
          event.preventDefault();
          focusTarget.focus();
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1 pt-1.5">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description> : null}
          </div>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon" className="-mr-2 -mt-1 shrink-0" aria-label={closeLabel ?? 'Close'}>
              <X aria-hidden="true" className="size-5" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogContent>
    </DialogPrimitive.Root>
  );
}

/** Stage 8 (mockups): a dialog's buttons — stacked on phones (confirm on top), right-aligned from `sm`. */
export function DialogActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end', className)}>{children}</div>;
}

/**
 * Stage 8 (mockups): a section card — header row with a divider (`h2` 16px, an optional count chip and an
 * action on the right), content full-bleed underneath.
 */
export function SectionCard({
  title,
  count,
  action,
  children,
  className,
  headerClassName,
  titleId,
  ...props
}: {
  title: React.ReactNode;
  count?: number | null;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  titleId?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card text-card-foreground', className)} aria-labelledby={titleId} {...props}>
      <div className={cn('flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2.5', headerClassName)}>
        <h2 id={titleId} className="flex min-w-0 items-center gap-2 text-base font-semibold">
          {title}
          {count !== undefined && count !== null ? <CountChip>{count}</CountChip> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CountChip({ children }: { children: React.ReactNode }) {
  return <span className="tnum rounded-md bg-muted px-1.5 text-xs font-normal text-muted-foreground ring-1 ring-border">{children}</span>;
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
  return <Badge dot variant={workOrderStatusVariant(status)}>{children}</Badge>;
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
