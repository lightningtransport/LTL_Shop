'use client';

import Link from 'next/link';
import { OctagonAlert, TriangleAlert } from 'lucide-react';
import { truckAttention, type TruckDashLampsDto, type TruckFaultDto } from '@ltl-shop/shared';
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

      {data.lamps ? <DashLamps lamps={data.lamps} messages={messages} /> : null}

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

/** S3-4: the truck's dash lights now. STOP and warning exist only here: J1939 does not say which code lit them. */
function DashLamps({ lamps, messages }: { lamps: TruckDashLampsDto; messages: AdminMessages }) {
  const on: Array<[string, 'destructive' | 'warning']> = [
    ...(lamps.stop ? [[messages.truckLampStop, 'destructive'] as [string, 'destructive']] : []),
    ...(lamps.warning ? [[messages.truckLampWarning, 'warning'] as [string, 'warning']] : []),
    ...(lamps.protect ? [[messages.truckLampProtect, 'warning'] as [string, 'warning']] : []),
    ...(lamps.emissions ? [[messages.truckLampEmissions, 'warning'] as [string, 'warning']] : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm" data-testid="truck-dash-lamps">
      <span className="text-muted-foreground">{messages.truckLampsNow}:</span>
      {on.length ? on.map(([label, variant]) => <Badge key={label} variant={variant}>{label}</Badge>) : <span>{messages.truckLampsNone}</span>}
    </div>
  );
}

/** S-3, S3-4: the line on the Truck's overview: the dash lights first, then codes that lit check engine. */
export function TruckFaultsBanner({ truckId, href, messages }: { truckId: string; href: string; messages: AdminMessages }) {
  const { data } = useAdminTruckFaults(truckId);
  const attention = data ? truckAttention(data.lamps, data.active.map((fault) => fault.severity)) : null;
  if (!data || !attention) return null;
  const stop = attention === 'stop';
  const Icon = stop ? OctagonAlert : TriangleAlert;
  const title = stop ? messages.truckFaultsBannerStop : attention === 'warning' ? messages.truckFaultsBannerWarning : messages.truckFaultsBannerCheckEngine;
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-sm', stop ? 'border-destructive/50 bg-destructive/15 text-destructive-text' : 'border-warning/40 bg-warning/10 text-warning-foreground')}
      data-testid="truck-faults-banner"
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{title}{data.active.length ? ` · ${data.active.length === 1 ? messages.truckFaultsBannerOneCode : fillPlaceholders(messages.truckFaultsBannerCodes, { count: String(data.active.length) })}` : ''}</span>
      <Link className="font-medium underline-offset-2 hover:underline" href={href}>{messages.truckFaultsSee}</Link>
    </div>
  );
}
