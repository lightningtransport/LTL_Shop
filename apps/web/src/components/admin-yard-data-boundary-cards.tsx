'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, MapPin, TriangleAlert, Wrench, type LucideIcon } from 'lucide-react';
import type {
  YardDataBoundaryDto,
  YardDispatchMissingTruckDto,
  YardDispatchShopTruckDto,
  YardIncomingTruckItemDto,
  YardSamsaraPlacesDto,
  YardSamsaraTruckDto,
  YardUpcomingDepartureItemDto,
} from '@ltl-shop/shared';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { cn } from '@/lib/utils';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { formatShortDateTime } from '@/lib/work-order-view';
import { shortLocation, yardPlaceText } from '@/lib/samsara-view';
import { dispatchRowPlace, fillYardText, matchesTruckSearch, orderDispatchRows } from '@/lib/yard-card';
import { AddFromSamsaraDialog } from './admin-add-from-samsara';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { formatAdminDateOnly } from '@/lib/admin-format';
import {
  formatYardBoundaryDrivers,
  yardDataBoundaryCardKind,
  yardDataBoundaryCopy,
  type YardDataBoundaryCardKind,
} from '@/lib/yard-data-boundary';
import { Badge } from './ui';

const ICONS = {
  workLocation: MapPin,
  incomingTrucks: ArrowDownToLine,
  upcomingDepartures: ArrowUpFromLine,
} as const satisfies Record<'workLocation' | 'incomingTrucks' | 'upcomingDepartures', LucideIcon>;

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

/**
 * LTR-120 / Stage 8 / D50: the Dispatch tab — Dispatch's arrivals and departures as rows (the Truck, where it is by
 * Samsara with the D49 rule, and the date; arrived or left at the end; a Truck leaving soon with work left is flagged),
 * and "Where trucks are · Samsara" (In shop and In yard chips; a wrench marks an open Work Order). A number the Shop
 * app does not have says so and can be added from Samsara.
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
  /** "Leaving soon" window (YYYY-MM-DD): a departure inside it with work left is flagged. */
  today?: string | null;
  soonUntil?: string | null;
  /** D50: Add from Samsara created a truck; reload Dispatch so its row links to it. */
  onTruckAdded?: () => void;
}) {
  const copy = yardDataBoundaryCopy(locale);
  const canAdd = useCanShowManagerWrites();
  const [adding, setAdding] = useState<YardDispatchMissingTruckDto | null>(null);
  const options = { loading, fetchFailed };
  const incomingItems = (boundary?.incomingTrucks.items ?? []).filter((item) => matchesTruckSearch(item.truckNumber, search));
  const departureItems = (boundary?.upcomingDepartures.items ?? []).filter((item) => matchesTruckSearch(item.truckNumber, search));
  // Stage 6 / D50: the shop's side of each Truck — rows open the Truck; numbers the Shop app lacks can be added.
  const shop = new Map((boundary?.shop ?? []).map((truck) => [truck.truckNumber, truck]));
  const missing = new Map((boundary?.missing ?? []).map((truck) => [truck.truckNumber, truck]));
  const add = canAdd ? setAdding : null;
  const places = boundary?.samsaraPlaces;
  const placesKind: YardDataBoundaryCardKind = places ? 'ok' : loading ? 'loading' : 'unavailable';

  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
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
          {boundary?.incomingTrucks.status === 'ok' ? <MovementRows locale={locale} messages={messages} items={incomingItems} dateKey="returnDate" shop={shop} missing={missing} onAdd={add} today={today} /> : null}
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
          {boundary?.upcomingDepartures.status === 'ok' ? <MovementRows locale={locale} messages={messages} items={departureItems} dateKey="outDate" shop={shop} missing={missing} onAdd={add} today={today} soonUntil={soonUntil} /> : null}
        </BoundaryCard>
        <BoundaryCard
          cardId="workLocation"
          icon={ICONS.workLocation}
          label={copy.workLocation.label}
          kind={placesKind}
          empty={copy.workLocation.empty}
          unavailable={copy.unavailable}
          badge={copy.badge}
          expanded={expanded}
          preview={places ? `${messages.presenceInShop} ${places.inShop.length} · ${messages.presenceInYard} ${places.inYard.length}` : ''}
        >
          {places ? <SamsaraPlaces locale={locale} messages={messages} places={places} search={search} /> : null}
        </BoundaryCard>
      </div>
      <AddFromSamsaraDialog target={adding} from={DISPATCH_FROM} messages={messages} onClose={() => setAdding(null)} onAdded={() => onTruckAdded?.()} />
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
    <section
      className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground"
      role="status"
      aria-label={ariaLabel}
      aria-busy={kind === 'loading'}
      data-testid={`yard-data-boundary-${cardId}`}
      data-kind={kind}
    >
      <h2 className="flex min-w-0 items-center gap-2 border-b px-4 py-3 font-semibold">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 break-words">{label}</span>
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

const LIST_PREVIEW = 12;
// LTR-245 (UX-5-006): the URL says what the tab says (LTR-207).
const DISPATCH_FROM = '/admin/yard-operations?tab=dispatch';

type Chip = { key: string; label: string; title?: string; href?: string; inShop?: boolean };
type ShopByNumber = Map<string, YardDispatchShopTruckDto>;

/** D50: "Where trucks are · Samsara" — In shop and In yard chips (D49), how many are outside, and where Dispatch disagrees. */
function SamsaraPlaces({ locale, messages, places, search }: { locale: AdminLocale; messages: AdminMessages; places: YardSamsaraPlacesDto; search: string }) {
  const chip = (truck: YardSamsaraTruckDto, inShop: boolean): Chip => ({
    key: truck.truckId,
    label: truck.truckNumber,
    href: adminTruckHref(truck.truckId, DISPATCH_FROM),
    inShop,
    title: [
      truck.openWorkOrder ? fillYardText(messages.yardDispatchInShop, { workOrder: truck.openWorkOrder.displayId }) : null,
      truck.inYardSince ? fillYardText(messages.presenceInYardSince, { since: formatShortDateTime(truck.inYardSince, locale) }) : null,
      truck.dispatch ? fillYardText(messages.yardDispatchSays, { location: truck.dispatch }) : null,
    ].filter(Boolean).join(' · ') || undefined,
  });
  const groups = [
    { key: 'in_shop', label: messages.presenceInShop, trucks: places.inShop, inShop: true },
    { key: 'in_yard', label: messages.presenceInYard, trucks: places.inYard, inShop: false },
  ].map((group) => ({ ...group, trucks: group.trucks.filter((truck) => matchesTruckSearch(truck.truckNumber, search)) }));
  const disagrees = places.dispatchDisagrees.filter((row) => matchesTruckSearch(row.truckNumber, search));
  return (
    <>
      <ul>
        {groups.map((group) => (
          <li key={group.key} className="min-w-0 border-b px-4 py-3" data-testid={`yard-samsara-${group.key}`}>
            <p className={cn('text-xs font-medium text-muted-foreground', group.trucks.length && 'mb-2')}>{group.label} · {group.trucks.length}</p>
            {group.trucks.length ? <ChipList messages={messages} chips={group.trucks.map((truck) => chip(truck, group.inShop))} /> : null}
          </li>
        ))}
        <li className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs text-muted-foreground" data-testid="yard-samsara-outside">
          <span>{fillYardText(messages.yardSamsaraOutside, { outside: String(places.outside), noGps: String(places.noGps) })}</span>
          <Link className="tap-inline text-primary underline-offset-2 hover:underline" href="/admin/trucks">{messages.yardSamsaraSeeTrucks}</Link>
        </li>
      </ul>
      {disagrees.length ? (
        <details className="border-b px-4 py-3 text-xs" data-testid="yard-dispatch-disagrees">
          <summary className="cursor-pointer text-warning-foreground dark:text-warning">
            <TriangleAlert aria-hidden="true" className="mr-1 inline size-3.5 align-[-2px]" />
            {fillYardText(messages.yardDispatchDisagrees, { count: String(disagrees.length) })}
          </summary>
          <ul className="mt-2 space-y-1">
            {disagrees.map((row) => (
              <li key={row.truckId}>
                <Link className="tap-inline font-semibold text-primary hover:underline" href={adminTruckHref(row.truckId, DISPATCH_FROM)}>{row.truckNumber}</Link>
                <span className="text-muted-foreground"> · {fillYardText(messages.yardDispatchSays, { location: row.dispatch })} · {row.samsara === 'in_yard' ? messages.yardSamsaraInYardShort : messages.yardSamsaraOutsideShort}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="flex items-center gap-1 px-4 py-3 text-xs text-muted-foreground"><Wrench aria-hidden="true" className="size-3.5" />{messages.yardHasOpenWo}</p>
    </>
  );
}

/** Arrivals and departures: the Truck, where it is by Samsara (D49), and the date; arrived or left at the end (D50). */
function MovementRows({
  locale,
  messages,
  items,
  dateKey,
  shop,
  missing,
  onAdd,
  today = null,
  soonUntil = null,
}: {
  locale: AdminLocale;
  messages: AdminMessages;
  items: Array<YardIncomingTruckItemDto | YardUpcomingDepartureItemDto>;
  dateKey: 'returnDate' | 'outDate';
  shop: ShopByNumber;
  missing: Map<string, YardDispatchMissingTruckDto>;
  /** Null when this person cannot add trucks. */
  onAdd: ((truck: YardDispatchMissingTruckDto) => void) | null;
  today?: string | null;
  soonUntil?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  if (!items.length) return <p className="px-4 py-3 text-muted-foreground">{messages.yardNoTrucksMatch}</p>;
  const list = dateKey === 'returnDate' ? 'incoming' : 'departures';
  // LTR-254: the API order (date, then truck number); D50: arrived or left go to the end.
  const rows = orderDispatchRows(items.map((item, index) => {
    const truck = shop.get(item.truckNumber);
    const date = dateKey === 'returnDate' ? (item as YardIncomingTruckItemDto).returnDate : (item as YardUpcomingDepartureItemDto).outDate;
    const day = date?.slice(0, 10) ?? null;
    return { item, index, truck, date, day, ...dispatchRowPlace(truck, list, day, today) };
  }));
  const visible = showAll ? rows : rows.slice(0, LIST_PREVIEW);
  return (
    <>
      <ul className="divide-y">
        {visible.map(({ item, index, truck, date, day, place, done }) => {
          const soon = Boolean(truck && !truck.readyToGo && truck.openWorkOrder && day && today && soonUntil && day >= today && day <= soonUntil && (truck.jobsLeft ?? 0) > 0);
          const drivers = formatYardBoundaryDrivers(item.drivers);
          const phase = truck?.phase && PHASE_KEY[truck.phase] ? (messages[PHASE_KEY[truck.phase]] as string) : null;
          const lack = place === 'missing' ? missing.get(item.truckNumber) ?? { truckNumber: item.truckNumber, samsaraVehicleId: null } : null;
          const where = truck?.samsara?.geofenceName ?? shortLocation(truck?.samsara?.address) ?? null;
          const yardText = truck ? yardPlaceText(truck.samsara, Boolean(truck.openWorkOrder), locale, messages) : null;
          return (
            <li
              key={`${item.truckNumber}-${date ?? 'undated'}-${index}`}
              className={cn('flex items-center gap-3 px-4 py-2.5', done && 'bg-muted/30')}
              title={drivers || undefined}
              data-testid="yard-movement-row"
              data-place={place}
              data-done={done ? 'true' : undefined}
            >
              {truck ? (
                <Link href={adminTruckHref(truck.truckId, DISPATCH_FROM)} data-in-shop={place === 'in_shop' ? 'true' : undefined} className="tap-inline w-16 shrink-0 truncate font-semibold text-primary hover:underline">{item.truckNumber}</Link>
              ) : <span className="w-16 shrink-0 truncate font-semibold text-muted-foreground">{item.truckNumber}</span>}
              <span className="min-w-0 flex-1 text-xs">
                {done ? <span className="font-semibold text-foreground">{`${list === 'incoming' ? messages.yardArrived : messages.yardLeft} · `}</span> : null}
                {place === 'ready_to_go' ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-success/40 px-1.5 py-px text-success">{messages.readyToGo}</span>
                ) : place === 'in_shop' ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-1.5 py-px text-primary">{phase ? fillYardText(messages.yardInShopPhase, { phase }) : messages.presenceInShop}</span>
                ) : place === 'in_yard' ? (
                  <span className="font-medium text-success">{yardText ?? messages.presenceInYard}</span>
                ) : place === 'outside' ? (
                  <span className="text-muted-foreground">{where ?? messages.noValue}</span>
                ) : place === 'no_gps' ? (
                  <span className="text-muted-foreground">{messages.yardNoGps}</span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-muted-foreground" title={messages.yardNotInShopAppHint} data-testid="yard-not-in-app">{messages.yardNotInShopApp}</span>
                    {onAdd && lack ? (
                      <button type="button" className="inline-flex h-8 items-center rounded-md border px-2 font-medium text-primary hover:bg-accent [@media(pointer:coarse)]:h-11" onClick={() => onAdd(lack)} data-testid="yard-add-from-samsara">{messages.yardAddFromSamsara}</button>
                    ) : null}
                  </span>
                )}
                {soon ? (
                  <span className="ml-1 inline-flex items-center gap-1 text-warning-foreground dark:text-warning">
                    <TriangleAlert aria-hidden="true" className="size-3.5" />{fillYardText(messages.dashJobsLeft, { count: String(truck?.jobsLeft ?? 0) })}
                  </span>
                ) : null}
              </span>
              <span className="tnum shrink-0 text-muted-foreground">{date ? formatAdminDateOnly(date, locale) : '—'}</span>
            </li>
          );
        })}
      </ul>
      {rows.length > LIST_PREVIEW ? (
        <div className="border-t p-2">
          <button type="button" className="h-9 w-full rounded-md font-medium text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setShowAll((value) => !value)}>
            {showAll ? messages.yardShowLess : messages.yardShowAll.replace('{count}', String(rows.length))}
          </button>
        </div>
      ) : null}
    </>
  );
}

function ChipList({ messages, chips }: { messages: AdminMessages; chips: Chip[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? chips : chips.slice(0, LIST_PREVIEW);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((chip) => {
        const body = <>{chip.label}{chip.inShop ? <Wrench aria-hidden="true" className="size-3.5" /> : null}</>;
        return chip.href ? (
          <Link
            key={chip.key}
            href={chip.href}
            title={chip.title}
            data-in-shop={chip.inShop ? 'true' : undefined}
            className={cn('inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-accent [@media(pointer:coarse)]:h-11', chip.inShop ? 'border-primary/40 text-primary' : 'text-muted-foreground')}
          >
            {body}
          </Link>
        ) : (
          <span key={chip.key} title={chip.title} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground">{body}</span>
        );
      })}
      {chips.length > LIST_PREVIEW ? (
        <button type="button" className="px-1 text-xs text-primary underline-offset-2 hover:underline" onClick={() => setShowAll((value) => !value)}>
          {showAll ? messages.yardShowLess : messages.yardShowAll.replace('{count}', String(chips.length))}
        </button>
      ) : null}
    </div>
  );
}
