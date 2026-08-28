'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  backHref,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  const { user } = useAuth();
  const label = eyebrow ?? user?.name ?? 'MECHANIC';

  return (
    <header className="mb-6">
      {backHref ? (
        <Link href={backHref} className="mb-3 inline-flex text-sm text-shop-muted">
          ← Back
        </Link>
      ) : null}
      <p className="section-label">{label}</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-shop-muted">{subtitle}</p>
      ) : null}
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
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-shop-border bg-shop-panel p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold tracking-wide">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-shop-muted hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const color =
    priority === 'critical'
      ? 'text-red-300 border-red-400/40'
      : priority === 'high'
        ? 'text-orange-300 border-orange-400/40'
        : priority === 'low'
          ? 'text-slate-300 border-slate-500/40'
          : 'text-amber-200 border-amber-400/40';
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${color}`}
    >
      {priority}
    </span>
  );
}
