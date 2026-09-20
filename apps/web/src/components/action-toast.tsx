'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useShopLocale } from '@/lib/locale-context';
import { Button } from './ui';

export type ActionToastKind = 'success' | 'error';

type ActionToast = {
  id: number;
  kind: ActionToastKind;
  message: string;
};

type ActionToastContextValue = {
  showToast: (kind: ActionToastKind, message: string) => void;
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

  const showToast = useCallback((kind: ActionToastKind, message: string) => {
    clearTimer();
    nextId.current += 1;
    setToast({ id: nextId.current, kind, message });
    timeoutRef.current = window.setTimeout(() => {
      setToast(null);
      timeoutRef.current = null;
    }, 6000);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <ActionToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[calc(1rem+var(--app-safe-bottom))]"
        >
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg',
              toast.kind === 'error'
                ? 'border-destructive/40 bg-destructive text-destructive-foreground'
                : 'border-shop-success/40 bg-shop-success text-white',
            )}
          >
            <p className="min-w-0 flex-1 font-medium">{toast.message}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 text-current hover:bg-white/15 hover:text-current"
              onClick={dismiss}
            >
              {messages.dismissNotice}
            </Button>
          </div>
        </div>
      ) : null}
    </ActionToastContext.Provider>
  );
}
