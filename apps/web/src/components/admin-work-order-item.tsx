'use client';

import Link from 'next/link';
import type { AdminWorkOrderSummaryDto } from '@ltl-shop/shared';
import { Badge, Button, PriorityBadge } from './ui';
import { formatAdminDate, humanize } from '@/lib/admin-format';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

export function AdminWorkOrderItem({ item, locale, messages, compact = false }: {
  item: AdminWorkOrderSummaryDto; locale: AdminLocale; messages: AdminMessages; compact?: boolean;
}) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="font-display text-lg font-semibold text-primary hover:underline" href={`/admin/work-orders/${item.id}`}>{item.displayId}</Link>
          <p className="mt-1 text-sm font-medium">{item.truck.truckNumber} · {item.category.name}</p>
        </div>
        <div className="flex flex-wrap gap-2"><PriorityBadge priority={item.priority} /><Badge variant="outline">{humanize(item.status)}</Badge></div>
      </div>
      <dl className={`mt-4 grid gap-3 text-sm ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        <div><dt className="text-muted-foreground">{messages.progress}</dt><dd className="font-medium">{item.jobsCompleted} / {item.jobsTotal}</dd></div>
        <div><dt className="text-muted-foreground">{messages.mechanicsLabel}</dt><dd className="font-medium">{item.mechanics.map((mechanic) => mechanic.mechanicName).join(', ') || '—'}</dd></div>
        <div><dt className="text-muted-foreground">{messages.updated}</dt><dd className="font-medium">{formatAdminDate(item.updatedAt, locale)}</dd></div>
      </dl>
      {item.currentPause ? <p className="mt-3 rounded-lg bg-warning-surface px-3 py-2 text-sm text-warning-foreground">{messages.currentPause}: {humanize(item.currentPause.reason)}</p> : null}
      {!compact ? <Button asChild variant="outline" size="sm" className="mt-4"><Link href={`/admin/work-orders/${item.id}`}>{messages.details}</Link></Button> : null}
    </article>
  );
}
