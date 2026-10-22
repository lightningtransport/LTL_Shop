'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { Button } from './ui';

/**
 * Stage 4 (T5, UX-5-006): a panel on the right on desktop and a full-height sheet on phones, so a
 * long form (Add work) opens next to the button that asked for it instead of at the end of the page.
 * The body scrolls; the footer (the form's actions) stays fixed.
 */
export function SideSheet({
  open,
  title,
  description,
  closeLabel,
  onClose,
  footer,
  children,
  testId,
  dismissible = true,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
  /** LTR-293 §14: false while something is typed, so Escape or a tap outside does not throw it away (Close still does). */
  dismissible?: boolean | (() => boolean);
}) {
  // A function is read at the moment of Escape or the tap outside, so a change made just before counts.
  const canDismiss = () => (typeof dismissible === 'function' ? dismissible() : dismissible);
  const contentRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // LTR-293 §14: remember what opened the sheet, so closing gives the focus back to it (not to <body>).
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && !contentRef.current?.contains(active)) returnFocus.current = active;
  }, [open]);

  // Stage QC-3: a toast rises above the sheet's fixed footer instead of covering its buttons (UX-1-008).
  const hasFooter = Boolean(footer);
  useEffect(() => {
    if (!open || !hasFooter) return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('--toast-lift');
    root.style.setProperty('--toast-lift', '4.5rem');
    return () => {
      if (previous) root.style.setProperty('--toast-lift', previous);
      else root.style.removeProperty('--toast-lift');
    };
  }, [open, hasFooter]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          data-testid={testId}
          aria-describedby={undefined}
          ref={contentRef}
          tabIndex={-1}
          // LTR-293 §14: focus goes into the sheet (keyboard and screen readers land in it), on the sheet itself, so a
          // phone does not open its keyboard on a field.
          onOpenAutoFocus={(event) => { event.preventDefault(); contentRef.current?.focus({ preventScroll: true }); }}
          onCloseAutoFocus={(event) => {
            if (!returnFocus.current?.isConnected) return;
            event.preventDefault();
            returnFocus.current.focus();
          }}
          onEscapeKeyDown={(event) => { if (!canDismiss()) event.preventDefault(); }}
          onInteractOutside={(event) => { if (!canDismiss()) event.preventDefault(); }}
          // A button that disappears after a tap (a Job just added) sends focus to <body>; that is not leaving the sheet.
          onFocusOutside={(event) => event.preventDefault()}
          // LTR-234: on phones it stands on top of the keyboard (globals.css).
          data-sheet=""
          data-sheet-side=""
          className="anim-sheet-in fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border-t bg-card text-card-foreground shadow-2xl focus:outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[460px] sm:rounded-none sm:border-l sm:border-t-0"
        >
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0 space-y-1">
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {description ? <div className="text-muted-foreground">{description}</div> : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="-mr-2 shrink-0" aria-label={closeLabel}>
                <X aria-hidden="true" className="size-5" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? <div data-sheet-footer="" className="border-t px-5 py-3 pb-[calc(0.75rem+var(--app-safe-bottom))]">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
