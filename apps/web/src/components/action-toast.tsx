'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useShopLocale } from '@/lib/locale-context';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { Button } from './ui';

export type ActionToastKind = 'success' | 'error';

/** LTR-218: a one-tap action can offer its way back ("Undo") right in the toast. */
export type ActionToastAction = { label: string; onAction: () => void };

type ActionToast = {
  id: number;
  kind: ActionToastKind;
  message: string;
  action?: ActionToastAction;
};

type ActionToastContextValue = {
  showToast: (kind: ActionToastKind, message: string, action?: ActionToastAction) => void;
  /** Stage MG-5 (UX-1-008): a sheet that opens closes the toast so it never covers the sheet's buttons. */
  dismissToast: () => void;
};

const ActionToastContext = createContext<ActionToastContextValue | null>(null);

export function useActionToast() {
  const context = useContext(ActionToastContext);
  if (!context) {
    throw new Error('useActionToast must be used within ActionToastProvider');
  }
  return context;
}

export function ActionToastProvider({ children }: { children: React.ReactNode }) {
  const { messages } = useShopLocale();
  const [toast, setToast] = useState<ActionToast | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const nextId = useRef(0);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const showToast = useCallback((kind: ActionToastKind, message: string, action?: ActionToastAction) => {
    clearTimer();
    nextId.current += 1;
    setToast({ id: nextId.current, kind, message, action });
    // With an Undo, a little longer to read and reach it.
    timeoutRef.current = window.setTimeout(() => {
      setToast(null);
      timeoutRef.current = null;
    }, action ? 8000 : 6000);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <ActionToastContext.Provider value={{ showToast, dismissToast: dismiss }}>
      {children}
      {toast ? (
        // Stage 8 (F4, mockups): a neutral card with a colored icon, bottom-right from `sm`; it rises above a
        // fixed bar at the bottom (the Work Order's "Confirm completion") through --toast-lift.
        <div
          className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+var(--app-safe-bottom)+var(--toast-lift,0px)+var(--keyboard-inset,0px))] z-[60] flex justify-center sm:inset-x-auto sm:right-4 sm:justify-end"
        >
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'anim-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-sm text-card-foreground shadow-xl sm:w-[360px]',
              toast.kind === 'error' ? 'border-destructive/50' : '',
            )}
          >
            {toast.kind === 'error'
              ? <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive-text" />
              : <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />}
            <p className="min-w-0 flex-1">{toast.message}</p>
            {toast.action ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="-my-1 shrink-0"
                onClick={() => { const { onAction } = toast.action!; dismiss(); onAction(); }}
              >
                {toast.action.label}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" className="-my-1 -mr-1.5 shrink-0" onClick={dismiss}>
              {messages.dismissNotice}
            </Button>
          </div>
        </div>
      ) : null}
    </ActionToastContext.Provider>
  );
}
