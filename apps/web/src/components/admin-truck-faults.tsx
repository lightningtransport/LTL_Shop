'use client';

import Link from 'next/link';
import { OctagonAlert, TriangleAlert } from 'lucide-react';
import type { TruckFaultDto } from '@ltl-shop/shared';
import { Badge, LoadFailure, PageSkeleton, SectionCard } from './ui';
import { useAdminTruckFaults } from '@/lib/admin-data';
import { formatAdminAgo, formatAdminDate } from '@/lib/admin-format';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { faultSeverityLabel, faultSeverityVariant } from '@/lib/samsara-view';
import { cn } from '@/lib/utils';

/**
 * D35 / S-3 (OPEN_ISSUES §1x): Truck → Faults. What Samsara reports now (worst first) and what it stopped reporting.
 * Read-only: turning a fault into a Job is S-6 (D42).
 */
export function AdminTruckFaults({ truckId, locale, messages }: { truckId: string; locale: AdminLocale; messages: AdminMessages }) {
  const { data, error, isLoading, mutate } = useAdminTruckFaults(truckId);

  if (isLoading && !data) return <PageSkeleton label={messages.truckFaultsTab} header={false} />;
  if (error || !data) return <LoadFailure message={messages.truckFaultsLoadFailed} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  return (
    <div className="space-y-5" data-testid="truck-faults">
      {data.paired ? (
        data.syncedAt ? <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.truckFaultsSynced, { ago: formatAdminAgo(data.syncedAt, locale) })}</p> : null
      ) : (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          {messages.truckFaultsNotPaired} <Link className="text-primary hover:underline" href="/admin/setup/samsara">{messages.samsaraNav}</Link>
        </p>
      )}

      <SectionCard title={messages.truckFaultsActive} count={data.active.length}>
        {data.active.length ? (
          <ul className="divide-y">
            {data.active.map((fault) => <FaultRow key={fault.id} fault={fault} locale={locale} messages={messages} />)}
          </ul>
        ) : <p className="px-4 py-3 text-sm text-muted-foreground">{messages.truckFaultsEmptyActive}</p>}
      </SectionCard>

      <SectionCard title={messages.truckFaultsHistory} count={data.history.length}>
        {data.history.length ? (
          <ul className="divide-y">
            {data.history.map((fault) => <FaultRow key={fault.id} fault={fault} locale={locale} messages={messages} />)}
          </ul>
        ) : <p className="px-4 py-3 text-sm text-muted-foreground">{messages.truckFaultsEmptyHistory}</p>}
      </SectionCard>
    </div>
  );
}

function FaultRow({ fault, locale, messages }: { fault: TruckFaultDto; locale: AdminLocale; messages: AdminMessages }) {
  const cleared = Boolean(fault.clearedAt);
  return (
    <li className="space-y-1 px-4 py-3" data-testid="truck-fault">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {cleared ? <Badge variant="outline">{messages.truckFaultsClearedBadge}</Badge> : <Badge variant={faultSeverityVariant(fault.severity)}>{faultSeverityLabel(fault.severity, messages)}</Badge>}
        <span className="text-xs text-muted-foreground">
          {cleared
            ? fillPlaceholders(messages.truckFaultsCleared, { date: formatAdminDate(fault.clearedAt, locale) })
            : [fillPlaceholders(messages.truckFaultsSince, { date: formatAdminDate(fault.firstSeenAt, locale) }), fault.occurrenceCount ? fillPlaceholders(messages.truckFaultsTimes, { count: String(fault.occurrenceCount) }) : null].filter(Boolean).join(' · ')}
        </span>
      </div>
      <p className={cn('font-medium', cleared && 'text-muted-foreground')}>{fault.description}</p>
      <p className="font-mono text-xs text-muted-foreground">{[fault.protocol === 'j1939' ? 'J1939' : 'OBD-II', fault.code, fault.sourceName].filter(Boolean).join(' · ')}</p>
    </li>
  );
}

/** S-3: the line on the Truck's overview when Samsara reports faults (Manager and System Admin). */
export function TruckFaultsBanner({ truckId, href, messages }: { truckId: string; href: string; messages: AdminMessages }) {
  const { data } = useAdminTruckFaults(truckId);
  const shown = data?.active.filter((fault) => fault.severity !== 'info' && fault.severity !== 'pending') ?? [];
  if (!shown.length) return null;
  const stop = shown.some((fault) => fault.severity === 'stop');
  const Icon = stop ? OctagonAlert : TriangleAlert;
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-sm', stop ? 'border-destructive/50 bg-destructive/15 text-destructive-text' : 'border-warning/40 bg-warning/10 text-warning-foreground')}
      data-testid="truck-faults-banner"
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{fillPlaceholders(stop ? messages.truckFaultsBannerStop : messages.truckFaultsBanner, { count: String(shown.length) })}</span>
      <Link className="font-medium underline-offset-2 hover:underline" href={href}>{messages.truckFaultsSee}</Link>
    </div>
  );
}
