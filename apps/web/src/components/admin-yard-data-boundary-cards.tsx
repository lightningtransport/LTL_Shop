'use client';

import type { ReactNode } from 'react';
import { ShieldCheck, Truck, type LucideIcon } from 'lucide-react';
import type {
  YardDataBoundaryDto,
  YardIncomingTruckItemDto,
  YardUpcomingDepartureItemDto,
  YardWorkLocationItemDto,
} from '@ltl-shop/shared';
import type { AdminLocale } from '@/lib/admin-messages';
import { formatAdminDateOnly } from '@/lib/admin-format';
import {
  formatYardBoundaryDrivers,
  yardDataBoundaryCardKind,
  yardDataBoundaryCopy,
  type YardDataBoundaryCardKind,
} from '@/lib/yard-data-boundary';
import { Badge } from './ui';

const ICONS = {
  workLocation: Truck,
  incomingTrucks: Truck,
  upcomingDepartures: ShieldCheck,
} as const satisfies Record<'workLocation' | 'incomingTrucks' | 'upcomingDepartures', LucideIcon>;

export function AdminYardDataBoundaryCards({
  locale,
  boundary,
  loading,
  fetchFailed,
  expanded,
}: {
  locale: AdminLocale;
  boundary: YardDataBoundaryDto | undefined;
  loading: boolean;
  fetchFailed: boolean;
  expanded: boolean;
}) {
  const copy = yardDataBoundaryCopy(locale);
  const options = { loading, fetchFailed };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5 xl:grid-cols-3">
      <BoundaryCard
        cardId="workLocation"
        icon={ICONS.workLocation}
        label={copy.workLocation.label}
        kind={yardDataBoundaryCardKind(boundary?.workLocation, options)}
        empty={copy.workLocation.empty}
        unavailable={copy.unavailable}
        badge={copy.badge}
        expanded={expanded}
        preview={workLocationPreview(boundary?.workLocation.items ?? [], boundary?.workLocation.summary)}
      >
        {boundary?.workLocation.status === 'ok' ? (
          <WorkLocationItems items={boundary.workLocation.items} summary={boundary.workLocation.summary} />
        ) : null}
      </BoundaryCard>
      <BoundaryCard
        cardId="incomingTrucks"
        icon={ICONS.incomingTrucks}
        label={copy.incomingTrucks.label}
        kind={yardDataBoundaryCardKind(boundary?.incomingTrucks, options)}
        empty={copy.incomingTrucks.empty}
        unavailable={copy.unavailable}
        badge={copy.badge}
        expanded={expanded}
        preview={movementPreview(locale, boundary?.incomingTrucks.items ?? [], 'returnDate')}
      >
        {boundary?.incomingTrucks.status === 'ok' ? (
          <MovementItems locale={locale} items={boundary.incomingTrucks.items} dateKey="returnDate" />
        ) : null}
      </BoundaryCard>
      <BoundaryCard
        cardId="upcomingDepartures"
        icon={ICONS.upcomingDepartures}
        label={copy.upcomingDepartures.label}
        kind={yardDataBoundaryCardKind(boundary?.upcomingDepartures, options)}
        empty={copy.upcomingDepartures.empty}
        unavailable={copy.unavailable}
        badge={copy.badge}
        expanded={expanded}
        preview={movementPreview(locale, boundary?.upcomingDepartures.items ?? [], 'outDate')}
      >
        {boundary?.upcomingDepartures.status === 'ok' ? (
          <MovementItems locale={locale} items={boundary.upcomingDepartures.items} dateKey="outDate" />
        ) : null}
      </BoundaryCard>
    </div>
  );
}

function BoundaryCard({
  cardId,
  icon: Icon,
  label,
  kind,
  empty,
  unavailable,
  badge,
  expanded,
  preview,
  children,
}: {
  cardId: 'workLocation' | 'incomingTrucks' | 'upcomingDepartures';
  icon: LucideIcon;
  label: string;
  kind: YardDataBoundaryCardKind;
  empty: string;
  unavailable: string;
  badge: string;
  expanded: boolean;
  preview: string;
  children: ReactNode;
}) {
  const ariaLabel = kind === 'unavailable' ? `${label}. ${unavailable}` : kind === 'empty' ? `${label}. ${empty}` : label;

  return (
    <div
      className="min-w-0 rounded-lg border bg-card/70 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground"
      role="status"
      title={ariaLabel}
      aria-label={ariaLabel}
      aria-busy={kind === 'loading'}
      data-testid={`yard-data-boundary-${cardId}`}
      data-kind={kind}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 basis-24 whitespace-normal break-words text-foreground">{label}</span>
        {kind === 'unavailable' ? <Badge variant="secondary" className="shrink-0">{badge}</Badge> : null}
        {kind === 'empty' && !expanded ? <span className="min-w-0 basis-28 truncate">{empty}</span> : null}
        {kind === 'ok' && !expanded && preview ? <span className="min-w-0 basis-28 truncate">{preview}</span> : null}
      </div>
      {kind === 'loading' ? (
        <div className="mt-1.5 space-y-1" aria-hidden="true">
          <div className="h-2.5 w-28 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
        </div>
      ) : null}
      {kind === 'unavailable' && expanded ? <p className="mt-1 whitespace-normal break-words">{unavailable}</p> : null}
      {kind === 'empty' && expanded ? <p className="mt-1 whitespace-normal break-words">{empty}</p> : null}
      {kind === 'ok' && expanded ? <div className="mt-1.5">{children}</div> : null}
    </div>
  );
}

function workLocationPreview(items: YardWorkLocationItemDto[], summary?: string) {
  if (summary) return summary;
  const first = items[0];
  if (!first) return '';
  return first.location ? `${first.truckNumber} · ${first.location}` : first.truckNumber;
}

function movementPreview(
  locale: AdminLocale,
  items: Array<YardIncomingTruckItemDto | YardUpcomingDepartureItemDto>,
  dateKey: 'returnDate' | 'outDate',
) {
  const first = items[0];
  if (!first) return '';
  const date = dateKey === 'returnDate'
    ? (first as YardIncomingTruckItemDto).returnDate
    : (first as YardUpcomingDepartureItemDto).outDate;
  const formatted = formatAdminDateOnly(date, locale);
  return date ? `${first.truckNumber} · ${formatted}` : first.truckNumber;
}

function WorkLocationItems({
  items,
  summary,
}: {
  items: YardWorkLocationItemDto[];
  summary?: string;
}) {
  return (
    <div className="space-y-1">
      {summary ? <p className="font-medium text-foreground">{summary}</p> : null}
      <ul className="max-h-36 space-y-0.5 overflow-y-auto">
        {items.map((item, index) => (
          <li key={`${item.truckNumber}-${index}`} className="min-w-0 truncate">
            <span className="font-medium text-foreground">{item.truckNumber}</span>
            {item.location ? <span> · {item.location}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MovementItems({
  locale,
  items,
  dateKey,
}: {
  locale: AdminLocale;
  items: Array<YardIncomingTruckItemDto | YardUpcomingDepartureItemDto>;
  dateKey: 'returnDate' | 'outDate';
}) {
  return (
    <ul className="max-h-36 space-y-1 overflow-y-auto">
      {items.map((item, index) => {
        const date = dateKey === 'returnDate'
          ? (item as YardIncomingTruckItemDto).returnDate
          : (item as YardUpcomingDepartureItemDto).outDate;
        const drivers = formatYardBoundaryDrivers(item.drivers);
        return (
          <li key={`${item.truckNumber}-${date ?? 'undated'}-${index}`} className="min-w-0">
            <p className="truncate">
              <span className="font-medium text-foreground">{item.truckNumber}</span>
              {date ? <span> · {formatAdminDateOnly(date, locale)}</span> : null}
            </p>
            {drivers ? <p className="truncate">{drivers}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
