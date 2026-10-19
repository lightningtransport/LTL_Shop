'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, MapPin, TriangleAlert, Wrench, type LucideIcon } from 'lucide-react';
import type {
  YardDataBoundaryDto,
  YardDispatchShopTruckDto,
  YardIncomingTruckItemDto,
  YardUpcomingDepartureItemDto,
  YardWorkLocationItemDto,
} from '@ltl-shop/shared';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { cn } from '@/lib/utils';
import { dispatchShopConflicts, fillYardText, groupWorkLocations, matchesTruckSearch } from '@/lib/yard-card';
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
 * LTR-120 / Stage 6 (D8) / Stage 8 (mockup): the Dispatch tab — three columns: arrivals and departures as rows
 * (the Truck, where the shop has it and the date; a Truck leaving soon with work left is flagged) and where
 * Dispatch has each Truck (chips; a wrench marks an open Work Order). Disagreements with the shop come first.
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
}) {
  const copy = yardDataBoundaryCopy(locale);
  const options = { loading, fetchFailed };
  const workLocationItems = (boundary?.workLocation.items ?? []).filter((item) => matchesTruckSearch(item.truckNumber, search));
  const incomingItems = (boundary?.incomingTrucks.items ?? []).filter((item) => matchesTruckSearch(item.truckNumber, search));
  const departureItems = (boundary?.upcomingDepartures.items ?? []).filter((item) => matchesTruckSearch(item.truckNumber, search));
  // Stage 6 (D8): the shop's side of each Truck — rows and chips open the Truck; open Work Orders are marked.
  const shop = new Map((boundary?.shop ?? []).map((truck) => [truck.truckNumber, truck]));
  const conflicts = dispatchShopConflicts(boundary?.workLocation, boundary?.shop);

  return (
    <div className="space-y-4">
      {conflicts.length ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-surface/50 px-4 py-3" role="status" data-testid="yard-dispatch-conflicts">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" />
          <div className="min-w-0">
            <p className="font-medium">{messages.yardDispatchConflictTitle}</p>
            <ul className="mt-1 space-y-1">
              {conflicts.map((conflict) => (
                <li key={conflict.truckNumber}>
                  <Link className="underline underline-offset-2" href={adminTruckHref(conflict.truckId, DISPATCH_FROM)}>
                    {fillYardText(messages.yardDispatchConflict, { truck: conflict.truckNumber, location: conflict.location, workOrder: conflict.workOrder.displayId })}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
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
          {boundary?.incomingTrucks.status === 'ok' ? <MovementRows locale={locale} messages={messages} items={incomingItems} dateKey="returnDate" shop={shop} /> : null}
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
          {boundary?.upcomingDepartures.status === 'ok' ? <MovementRows locale={locale} messages={messages} items={departureItems} dateKey="outDate" shop={shop} today={today} soonUntil={soonUntil} /> : null}
        </BoundaryCard>
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
          {boundary?.workLocation.status === 'ok' ? <WorkLocationItems locale={locale} messages={messages} items={workLocationItems} shop={shop} /> : null}
        </BoundaryCard>
      </div>
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

const LIST_PREVIEW = 12;
// LTR-245 (UX-5-006): the URL says what the tab says (LTR-207).
const DISPATCH_FROM = '/admin/yard-operations?tab=dispatch';

type Chip = { key: string; label: string; title?: string; href?: string; inShop?: boolean };
type ShopByNumber = Map<string, YardDispatchShopTruckDto>;

/** Stage 6: a chip opens its Truck when the shop knows it; an open Work Order marks it (and sorts it first). */
function shopChip(truckNumber: string, chip: Omit<Chip, 'href' | 'inShop'>, shop: ShopByNumber, messages: AdminMessages): Chip {
  const truck = shop.get(truckNumber);
  if (!truck) return chip;
  return {
    ...chip,
    href: adminTruckHref(truck.truckId, DISPATCH_FROM),
    inShop: Boolean(truck.openWorkOrder),
    title: [chip.title, truck.openWorkOrder ? fillYardText(messages.yardDispatchInShop, { workOrder: truck.openWorkOrder.displayId }) : null].filter(Boolean).join(' · ') || undefined,
  };
}

function WorkLocationItems({
  locale,
  messages,
  items,
  shop,
}: {
  locale: AdminLocale;
  messages: AdminMessages;
  items: YardWorkLocationItemDto[];
  shop: ShopByNumber;
}) {
  if (!items.length) return <p className="px-4 py-3 text-muted-foreground">{messages.yardNoTrucksMatch}</p>;
  // LTR-103: group by reported status so 50+ rows read as a few lines.
  const groups = groupWorkLocations(items, messages.yardNoReportedLocation);
  return (
    <>
      <ul>
        {groups.map((group) => (
          <li key={group.location} className="min-w-0 border-b px-4 py-3 last:border-b-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{group.location} · {group.trucks.length}</p>
            <ChipList messages={messages} chips={group.trucks.map((truck) => shopChip(truck, { key: truck, label: truck }, shop, messages))} />
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1 border-t px-4 py-3 text-xs text-muted-foreground"><Wrench aria-hidden="true" className="size-3.5" />{messages.yardHasOpenWo}</p>
    </>
  );
}

/** Arrivals and departures: the Truck, where the shop has it, and the date. */
function MovementRows({
  locale,
  messages,
  items,
  dateKey,
  shop,
  today = null,
  soonUntil = null,
}: {
  locale: AdminLocale;
  messages: AdminMessages;
  items: Array<YardIncomingTruckItemDto | YardUpcomingDepartureItemDto>;
  dateKey: 'returnDate' | 'outDate';
  shop: ShopByNumber;
  today?: string | null;
  soonUntil?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  if (!items.length) return <p className="px-4 py-3 text-muted-foreground">{messages.yardNoTrucksMatch}</p>;
  // Trucks the shop is working on first (stable otherwise).
  const rows = items
    .map((item, index) => ({ item, index, truck: shop.get(item.truckNumber) }))
    .sort((left, right) => Number(Boolean(right.truck)) - Number(Boolean(left.truck)) || left.index - right.index);
  const visible = showAll ? rows : rows.slice(0, LIST_PREVIEW);
  return (
    <>
      <ul className="divide-y">
        {visible.map(({ item, index, truck }) => {
          const date = dateKey === 'returnDate' ? (item as YardIncomingTruckItemDto).returnDate : (item as YardUpcomingDepartureItemDto).outDate;
          const day = date?.slice(0, 10) ?? null;
          const soon = Boolean(truck && !truck.readyToGo && truck.openWorkOrder && day && today && soonUntil && day >= today && day <= soonUntil && (truck.jobsLeft ?? 0) > 0);
          const drivers = formatYardBoundaryDrivers(item.drivers);
          const phase = truck?.phase && PHASE_KEY[truck.phase] ? (messages[PHASE_KEY[truck.phase]] as string) : null;
          return (
            <li key={`${item.truckNumber}-${date ?? 'undated'}-${index}`} className="flex items-center gap-3 px-4 py-2.5" title={drivers || undefined}>
              {truck ? (
                <Link href={adminTruckHref(truck.truckId, DISPATCH_FROM)} data-in-shop={truck.openWorkOrder ? 'true' : undefined} className="w-16 shrink-0 truncate font-semibold text-primary hover:underline">{item.truckNumber}</Link>
              ) : <span className="w-16 shrink-0 truncate font-semibold">{item.truckNumber}</span>}
              <span className="min-w-0 flex-1">
                {truck?.readyToGo ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-success/40 px-1.5 py-px text-xs text-success">{messages.readyToGo}</span>
                ) : truck?.openWorkOrder ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-1.5 py-px text-xs text-primary">{phase ? fillYardText(messages.yardInShopPhase, { phase }) : fillYardText(messages.yardDispatchInShop, { workOrder: truck.openWorkOrder.displayId })}</span>
                ) : <span className="text-xs text-muted-foreground">{messages.yardNotInShop}</span>}
                {soon ? (
                  <span className="ml-1 inline-flex items-center gap-1 text-xs text-warning-foreground dark:text-warning">
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
            className={cn('inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-accent', chip.inShop ? 'border-primary/40 text-primary' : 'text-muted-foreground')}
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
