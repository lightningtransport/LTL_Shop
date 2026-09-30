'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from './ui';

/**
 * LTR-174: the context column of Truck Detail and the Admin Work Order detail (desktop: right column,
 * ≈ 1/3; phones: below the main column, same order). It holds what the Manager reads while working
 * (Truck / Work Order context, times, mechanics, priority) and the folded sections. One Card with
 * divided blocks, never a Card inside a Card.
 */
export function AdminContextSidebar({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <aside aria-label={label} className={cn('min-w-0 space-y-4', className)}>
      {children}
    </aside>
  );
}

/** One surface holding several `ContextBlock`s separated by dividers. */
export function ContextCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn('divide-y p-0', className)}>{children}</Card>;
}

/** A titled block inside `ContextCard`. */
export function ContextBlock({
  title,
  children,
  className,
  testId,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn('space-y-2 p-4', className)} data-testid={testId}>
      <h3 className="group-title">{title}</h3>
      {children}
    </section>
  );
}

/** Label / value pairs, one per line in the sidebar (two columns while the sidebar is full width on phones). */
export function ContextFacts({ items, label }: { items: Array<{ key: string; label: string; value: ReactNode }>; label?: string }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-1" aria-label={label}>
      {items.map((item) => (
        <div key={item.key} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words text-right font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
