'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, type LucideIcon } from 'lucide-react';
import type {
  YardDataBoundaryDto,
  YardDispatchMissingTruckDto,
  YardDispatchShopTruckDto,
  YardIncomingTruckItemDto,
  YardUpcomingDepartureItemDto,
} from '@ltl-shop/shared';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { cn } from '@/lib/utils';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { intlLocale } from '@/lib/shop-locale';
import { formatTime } from '@/lib/work-order-view';
import { shortLocation, yardPlaceText } from '@/lib/samsara-view';
import { dispatchRowPlace, fillYardText, groupDispatchDays, matchesTruckSearch, orderDispatchRows } from '@/lib/yard-card';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { formatAdminDateOnly } from '@/lib/admin-format';
import {
  formatYardBoundaryDrivers,
  yardDataBoundaryCardKind,
  yardDataBoundaryCopy,
  type YardDataBoundaryCardKind,
} from '@/lib/yard-data-boundary';
import { AddFromSamsaraDialog } from './admin-add-from-samsara';
import { NewWorkOrderDialog } from './new-work-order-dialog';
import { Badge } from './ui';

const PHASE_KEY: Record<string, keyof AdminMessages> = {
  inspection: 'inspection',
  shop_work: 'shopWork',
  pm: 'pm',
  alignment: 'alignment',
  detailing: 'detailing',
  quality_check: 'qualityCheck',
  ready_to_close: 'readyToClose',
  ready_to_go: 'readyToGo',
};

// LTR-245 (UX-5-006): the URL says what the tab says (LTR-207).
const DISPATCH_FROM = '/admin/yard-operations?tab=dispatch';

type List = 'incoming' | 'departures';
type Item = YardIncomingTruckItemDto | YardUpcomingDepartureItemDto;
type Row = ReturnType<typeof buildRow>;

function buildRow(item: Item, index: number, list: List, shop: Map<string, YardDispatchShopTruckDto>, today: string | null) {
  const truck = shop.get(item.truckNumber);
  const date = list === 'incoming' ? (item as YardIncomingTruckItemDto).returnDate : (item as YardUpcomingDepartureItemDto).outDate;
  const day = date?.slice(0, 10) ?? null;
  return { item, index, truck, date, day, ...dispatchRowPlace(truck, list, day, today) };
}

/**
 * LTR-120 / D50 / D51: the Dispatch tab is for planning the week — Dispatch's arrivals and departures, grouped by day.
 * Each day starts with what asks for action (arrived without a Work Order; leaving not ready), then what is still to
 * happen, then what already did. Where each truck is comes from Samsara (D49); a number the Shop app does not have says
 * so and can be added from Samsara.
 */
export function AdminYardDataBoundaryCards({
  locale,
  messages,
  boundary,
  loading,
  fetchFailed,
  expanded,
  search = '',
  today = null,
  soonUntil = null,
  onTruckAdded,
}: {
  locale: AdminLocale;
  messages: AdminMessages;
  boundary: YardDataBoundaryDto | undefined;
  loading: boolean;
  fetchFailed: boolean;
  expanded: boolean;
  /** LTR-103: filters every list by Truck number. */
  search?: string;
  /** Today (YYYY-MM-DD, shop time) and the "Leaving soon" window. */
  today?: string | null;
  soonUntil?: string | null;
  /** D50/D51: a truck was added or got a Work Order; reload Dispatch. */
  onTruckAdded?: () => void;
}) {
  const copy = yardDataBoundaryCopy(locale);
  const canWrite = useCanShowManagerWrites();
  const [adding, setAdding] = useState<YardDispatchMissingTruckDto | null>(null);
  const [opening, setOpening] = useState<{ id: string; truckNumber: string } | null>(null);
  const options = { loading, fetchFailed };
  const shop = new Map((boundary?.shop ?? []).map((truck) => [truck.truckNumber, truck]));
  const missing = new Map((boundary?.missing ?? []).map((truck) => [truck.truckNumber, truck]));
  const rowsOf = (items: Item[], list: List) => items
    .filter((item) => matchesTruckSearch(item.truckNumber, search))
    .map((item, index) => buildRow(item, index, list, shop, today));
  const incoming = rowsOf(boundary?.incomingTrucks.items ?? [], 'incoming');
  const departures = rowsOf(boundary?.upcomingDepartures.items ?? [], 'departures');
  const needWo = incoming.filter((row) => row.needsWorkOrder).length;
  const notReady = departures.filter((row) => row.notReady).length;
  const actions = {
    onAdd: canWrite ? setAdding : null,
    onCreateWo: canWrite ? setOpening : null,
  };

  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <BoundaryCard
          cardId="incomingTrucks"
          icon={ArrowDownToLine}
          label={copy.incomingTrucks.label}
          kind={yardDataBoundaryCardKind(boundary?.incomingTrucks, options)}
          empty={copy.incomingTrucks.empty}
          unavailable={copy.unavailable}
          badge={copy.badge}
          expanded={expanded}
          preview={preview(locale, incoming)}
          summary={needWo ? <span className="rounded-md border border-warning/40 bg-warning-surface/60 px-1.5 py-px text-xs font-medium text-warning-foreground" data-testid="yard-need-wo-count">{fillYardText(messages.yardNeedWoCount, { count: String(needWo) })}</span> : null}
        >
          {boundary?.incomingTrucks.status === 'ok' ? <DayGroups list="incoming" rows={incoming} locale={locale} messages={messages} missing={missing} today={today} soonUntil={soonUntil} {...actions} /> : null}
        </BoundaryCard>
        <BoundaryCard
          cardId="upcomingDepartures"
          icon={ArrowUpFromLine}
          label={copy.upcomingDepartures.label}
          kind={yardDataBoundaryCardKind(boundary?.upcomingDepartures, options)}
          empty={copy.upcomingDepartures.empty}
          unavailable={copy.unavailable}
          badge={copy.badge}
          expanded={expanded}
          preview={preview(locale, departures)}
          summary={notReady ? <span className="rounded-md border border-destructive/40 px-1.5 py-px text-xs font-medium text-destructive-text" data-testid="yard-not-ready-count">{fillYardText(messages.yardNotReadyCount, { count: String(notReady) })}</span> : null}
        >
          {boundary?.upcomingDepartures.status === 'ok' ? <DayGroups list="departures" rows={departures} locale={locale} messages={messages} missing={missing} today={today} soonUntil={soonUntil} {...actions} /> : null}
        </BoundaryCard>
      </div>
      <AddFromSamsaraDialog target={adding} from={DISPATCH_FROM} messages={messages} onClose={() => setAdding(null)} onAdded={() => onTruckAdded?.()} />
      {opening ? (
        <NewWorkOrderDialog open truck={opening} messages={messages} onClose={() => setOpening(null)} onCreated={() => { setOpening(null); onTruckAdded?.(); }} />
      ) : null}
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
  summary,
  children,
}: {
  cardId: 'incomingTrucks' | 'upcomingDepartures';
  icon: LucideIcon;
  label: string;
  kind: YardDataBoundaryCardKind;
  empty: string;
  unavailable: string;
  badge: string;
  expanded: boolean;
  preview: string;
  summary?: ReactNode;
  children: ReactNode;
}) {
  const ariaLabel = kind === 'unavailable' ? `${label}. ${unavailable}` : kind === 'empty' ? `${label}. ${empty}` : label;

  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground"
      role="status"
      aria-label={ariaLabel}
      aria-busy={kind === 'loading'}
      data-testid={`yard-data-boundary-${cardId}`}
      data-kind={kind}
    >
      <h2 className="flex min-w-0 flex-wrap items-center gap-2 border-b px-4 py-3 font-semibold">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 break-words">{label}</span>
        {kind === 'ok' ? summary : null}
        {kind === 'unavailable' ? <Badge variant="secondary" className="shrink-0">{badge}</Badge> : null}
      </h2>
      {kind === 'loading' ? (
        <div className="space-y-2 p-4" aria-hidden="true">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      ) : null}
      {kind === 'unavailable' ? <p className="px-4 py-3 text-muted-foreground">{unavailable}</p> : null}
      {kind === 'empty' ? <p className="px-4 py-3 text-muted-foreground">{empty}</p> : null}
      {kind === 'ok' && !expanded && preview ? <p className="truncate px-4 py-3 text-muted-foreground">{preview}</p> : null}
      {kind === 'ok' && expanded ? children : null}
    </section>
  );
}

function preview(locale: AdminLocale, rows: Row[]) {
  const first = rows[0];
  if (!first) return '';
  return first.date ? `${first.item.truckNumber} · ${formatAdminDateOnly(first.date, locale)}` : first.item.truckNumber;
}

/** D51: "Today · Mon, Oct 19", "Tomorrow · Tue, Oct 20", "Fri, Oct 30" (calendar days, shop time). */
function dayLabel(day: string | null, today: string | null, locale: AdminLocale, messages: AdminMessages) {
  if (!day) return messages.yardNoDate;
  const date = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00Z`));
  if (!today) return date;
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (day === today) return fillYardText(messages.yardDayToday, { date });
  if (day === tomorrow.toISOString().slice(0, 10)) return fillYardText(messages.yardDayTomorrow, { date });
  return date;
}

/** D51: one fold per day; today (or the first day) open. Inside, what asks for action first. */
function DayGroups({
  list,
  rows,
  locale,
  messages,
  missing,
  onAdd,
  onCreateWo,
  today,
  soonUntil,
}: {
  list: List;
  rows: Row[];
  locale: AdminLocale;
  messages: AdminMessages;
  missing: Map<string, YardDispatchMissingTruckDto>;
  /** Null when this person cannot add trucks or open Work Orders. */
  onAdd: ((truck: YardDispatchMissingTruckDto) => void) | null;
  onCreateWo: ((truck: { id: string; truckNumber: string }) => void) | null;
  today: string | null;
  soonUntil: string | null;
}) {
  if (!rows.length) return <p className="px-4 py-3 text-muted-foreground">{messages.yardNoTrucksMatch}</p>;
  const days = groupDispatchDays(rows);
  const openDay = days.some((group) => group.day === today) ? today : days[0]?.day;
  return (
    <div>
      {days.map((group) => {
        const done = group.rows.filter((row) => row.done).length;
        return (
          <details key={group.day ?? 'undated'} open={group.day === openDay || group.day === today} className="group border-b last:border-b-0" data-testid="yard-day">
            <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 px-4 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-open:rotate-0" />
              <span>{dayLabel(group.day, today, locale, messages)}</span>
              <span className="text-muted-foreground">· {group.rows.length}</span>
              {done ? (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {list === 'incoming'
                    ? fillYardText(messages.yardDayArriving, { here: String(done), coming: String(group.rows.length - done) })
                    : fillYardText(messages.yardDayLeaving, { left: String(done), still: String(group.rows.length - done) })}
                </span>
              ) : null}
            </summary>
            <ul className="divide-y border-t">
              {orderDispatchRows(group.rows).map((row) => (
                <DispatchRow key={`${row.item.truckNumber}-${row.index}`} row={row} list={list} locale={locale} messages={messages} missing={missing} onAdd={onAdd} onCreateWo={onCreateWo} today={today} soonUntil={soonUntil} />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function DispatchRow({
  row,
  list,
  locale,
  messages,
  missing,
  onAdd,
  onCreateWo,
  today,
  soonUntil,
}: {
  row: Row;
  list: List;
  locale: AdminLocale;
  messages: AdminMessages;
  missing: Map<string, YardDispatchMissingTruckDto>;
  onAdd: ((truck: YardDispatchMissingTruckDto) => void) | null;
  onCreateWo: ((truck: { id: string; truckNumber: string }) => void) | null;
  today: string | null;
  soonUntil: string | null;
}) {
  const { item, truck, day, place, done, needsWorkOrder, notReady, confirmReturn } = row;
  const drivers = formatYardBoundaryDrivers(item.drivers);
  const phase = truck?.phase && PHASE_KEY[truck.phase] ? (messages[PHASE_KEY[truck.phase]] as string) : null;
  const jobsLeft = truck?.jobsLeft ?? 0;
  const where = truck?.samsara?.geofenceName ?? shortLocation(truck?.samsara?.address) ?? null;
  const since = truck?.samsara?.inYardSince ?? null;
  const late = Boolean(list === 'incoming' && !done && day && today && day <= today);
  const soon = Boolean(list === 'departures' && notReady && day && today && soonUntil && day >= today && day <= soonUntil);
  const lack = place === 'missing' ? missing.get(item.truckNumber) ?? { truckNumber: item.truckNumber, samsaraVehicleId: null } : null;
  const button = 'inline-flex h-8 items-center rounded-md border px-2 text-xs font-medium text-primary hover:bg-accent [@media(pointer:coarse)]:h-11';
  const notHere = late ? <span className="rounded-md border border-warning/40 bg-warning-surface/60 px-1.5 py-px text-warning-foreground">{messages.yardNotHereYet}</span> : null;

  let status: ReactNode;
  if (place === 'missing') {
    status = (
      <>
        <span className="text-muted-foreground" title={messages.yardNotInShopAppHint} data-testid="yard-not-in-app">{messages.yardNotInShopApp}</span>
        {onAdd && lack ? <button type="button" className={button} onClick={() => onAdd(lack)} data-testid="yard-add-from-samsara">{messages.yardAddFromSamsara}</button> : null}
      </>
    );
  } else if (needsWorkOrder) {
    status = (
      <>
        <span className="rounded-md border border-success/40 px-1.5 py-px text-success">{since ? fillYardText(messages.yardArrivedAt, { time: formatTime(since, locale) }) : messages.yardArrived}</span>
        <span className="rounded-md border border-warning/40 bg-warning-surface/60 px-1.5 py-px font-medium text-warning-foreground" data-testid="yard-needs-wo">{messages.yardNeedsWorkOrder}</span>
        {onCreateWo && truck ? <button type="button" className={button} onClick={() => onCreateWo({ id: truck.truckId, truckNumber: item.truckNumber })} data-testid="yard-create-wo">{messages.yardCreateWo}</button> : null}
      </>
    );
  } else if (notReady) {
    status = (
      <>
        <span className={cn('rounded-md border px-1.5 py-px font-medium', soon ? 'border-destructive/40 text-destructive-text' : 'border-warning/40 text-warning-foreground')} data-testid="yard-not-ready">
          {fillYardText(messages.yardNotReady, { count: String(jobsLeft) })}
        </span>
        <span className="text-muted-foreground">{place === 'in_shop' && phase ? fillYardText(messages.yardInShopPhase, { phase }) : where ?? ''}</span>
      </>
    );
  } else if (confirmReturn) {
    // D52 (LTR-260): it left while Ready to Go; the Manager confirms Return to Service on the Truck or the Dashboard.
    status = (
      <>
        <span className="rounded-md border border-warning/40 bg-warning-surface/60 px-1.5 py-px font-medium text-warning-foreground" data-testid="yard-confirm-return">{messages.yardConfirmReturn}</span>
        <span className="text-muted-foreground">{where ?? ''}</span>
      </>
    );
  } else if (place === 'ready_to_go') {
    status = <span className="rounded-md border border-success/40 px-1.5 py-px text-success">{messages.readyToGo}</span>;
  } else if (place === 'in_shop') {
    status = <span className="rounded-md border border-primary/40 px-1.5 py-px text-primary">{phase ? fillYardText(messages.yardInShopPhase, { phase }) : messages.presenceInShop}</span>;
  } else if (place === 'in_yard') {
    status = list === 'departures'
      ? <span className="rounded-md border border-success/40 px-1.5 py-px text-success">{messages.yardReadyNothingOpen}</span>
      : <span className="font-medium text-success">{yardPlaceText(truck?.samsara, false, locale, messages) ?? messages.presenceInYard}</span>;
  } else if (place === 'outside') {
    status = <>{notHere}<span className="text-muted-foreground">{where ?? messages.noValue}</span></>;
  } else {
    status = <>{notHere}<span className="text-muted-foreground">{messages.yardNoGps}</span></>;
  }

  return (
    <li
      className={cn('flex min-h-11 items-center gap-3 px-4 py-2', done && !needsWorkOrder && !confirmReturn && 'bg-muted/30')}
      title={drivers || undefined}
      data-testid="yard-movement-row"
      data-place={place}
      data-done={done ? 'true' : undefined}
    >
      {truck ? (
        <Link href={adminTruckHref(truck.truckId, DISPATCH_FROM)} data-in-shop={place === 'in_shop' ? 'true' : undefined} className="tap-inline w-14 shrink-0 truncate font-semibold text-primary hover:underline">{item.truckNumber}</Link>
      ) : <span className="w-14 shrink-0 truncate font-semibold text-muted-foreground">{item.truckNumber}</span>}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        {done && list === 'departures' ? <span className="font-semibold text-foreground">{messages.yardLeft} ·</span> : null}
        {status}
      </span>
    </li>
  );
}
