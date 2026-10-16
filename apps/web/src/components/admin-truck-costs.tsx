'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2, Clock, Plus, Receipt } from 'lucide-react';
import { formatCents, type AdminTruckCostEntryDto } from '@ltl-shop/shared';
import { AdminNavLink } from './admin-nav-link';
import { ChargedOnChip } from './admin-charged-on';
import { Badge, Button, CompactEmpty, LoadFailure, PageSkeleton, SectionCard } from './ui';
import { useAdminTruckCosts } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { formatInvoiceDate } from '@/lib/parts-costs-format';
import { cn } from '@/lib/utils';

type Period = 'month' | '3months' | 'year' | 'all';

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The period as invoice dates (local calendar): this month, the last 3 months, this year, or everything. */
export function periodRange(period: Period, today = new Date()): { from?: string; to?: string } {
  if (period === 'all') return {};
  const to = iso(today);
  if (period === 'month') return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  if (period === '3months') return { from: iso(new Date(today.getFullYear(), today.getMonth() - 2, 1)), to };
  return { from: iso(new Date(today.getFullYear(), 0, 1)), to };
}

const PERIODS: Period[] = ['month', '3months', 'year', 'all'];

function sourceHref(entry: AdminTruckCostEntryDto, from: string) {
  const back = `?from=${encodeURIComponent(from)}`;
  if (entry.sourceType === 'part_purchase') return `/admin/parts/purchases/${entry.sourceId}${back}`;
  if (entry.sourceType === 'outside_repair') return `/admin/parts/outside-repairs/${entry.sourceId}${back}`;
  if (entry.sourceType === 'work_order_labor') return `/admin/work-orders/${entry.sourceId}${back}`;
  // D45 / ST-3: a part taken from stock opens its Work Order.
  if ((entry.sourceType === 'stock_issue' || entry.sourceType === 'pm_oil_change') && entry.workOrder) return `/admin/work-orders/${entry.workOrder.id}${back}`;
  return null;
}

/**
 * LTR-200 / D32 (PC-4): Truck → Costs. Totals for parts and outside repairs in the period, bars by month, and every
 * movement of the cost ledger (a void or an edit shows as its negative reversal). Labor and the charge to Finance
 * are reserved places: hours exist (D18), a rate does not yet. Shop Manager and System Admin only (D-PC7).
 * PCA1/PCA2: the period lives in the URL (`?tab=costs&period=`), and every link out carries `from` so Back returns here.
 */
export function AdminTruckCosts({ truckId, truckNumber, locale, messages }: { truckId: string; truckNumber: string; locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawPeriod = searchParams.get('period');
  const period: Period = PERIODS.includes(rawPeriod as Period) ? (rawPeriod as Period) : '3months';
  const here = `${pathname}?${searchParams.toString() || 'tab=costs'}`;
  const setPeriod = (next: Period) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'costs');
    if (next === '3months') params.delete('period'); else params.set('period', next);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };
  const query = useMemo(() => new URLSearchParams(Object.entries(periodRange(period)) as Array<[string, string]>).toString(), [period]);
  const { data, error, isLoading, mutate } = useAdminTruckCosts(truckId, query, true);
  const periods: Array<[Period, string]> = [['month', messages.pcPeriodMonth], ['3months', messages.pcPeriod3Months], ['year', messages.pcPeriodYear], ['all', messages.pcPeriodAll]];
  const maxMonth = Math.max(1, ...(data?.months ?? []).map((month) => Math.max(0, month.partsCents) + Math.max(0, month.outsideCents) + Math.max(0, month.laborCents)));
  const monthLabel = (month: string) => new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div className="space-y-6" data-testid="truck-costs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label={messages.pcPeriod} className="inline-flex flex-wrap rounded-lg border p-0.5">
          {periods.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={period === value}
              onClick={() => setPeriod(value)}
              className={cn('min-h-9 rounded-md px-3 text-sm', period === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><AdminNavLink href={`/admin/parts/purchases?new=1&forTruck=${truckId}&from=${encodeURIComponent(here)}`}><Plus aria-hidden="true" />{messages.pcAddPurchaseForTruck}</AdminNavLink></Button>
          <Button asChild variant="outline" size="sm"><AdminNavLink href={`/admin/parts/outside-repairs?new=1&forTruck=${truckId}&from=${encodeURIComponent(here)}`}><Plus aria-hidden="true" />{messages.pcAddOutsideForTruck}</AdminNavLink></Button>
        </div>
      </div>

      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.pcTruckCostsTab} header={false} /> : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="truck-costs-totals">
            {[
              [messages.pcCostsParts, data.totals.partsCents, Receipt],
              [messages.pcCostsOutside, data.totals.outsideCents, Building2],
            ].map(([label, cents, Icon]) => {
              const TileIcon = Icon as typeof Receipt;
              return (
                <div key={label as string} className="rounded-xl border bg-card px-4 py-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><TileIcon aria-hidden="true" className="size-3.5" />{label as string}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatCents(cents as number, locale)}</p>
                </div>
              );
            })}
            <div className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
              <p className="text-xs text-muted-foreground">{messages.pcCostsTotal}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums" data-testid="truck-costs-total">{formatCents(data.totals.totalCents, locale)}</p>
            </div>
            {/* LTR-201 / D34: labor of completed Work Orders (hours × the shop rate); hours alone until a rate is set. */}
            <div className="rounded-xl border bg-card px-4 py-3" data-testid="truck-costs-labor-tile">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock aria-hidden="true" className="size-3.5" />{messages.pcCostsLaborTitle}</p>
              {data.laborRateSet ? <p className="mt-1 text-lg font-semibold tabular-nums">{formatCents(data.totals.laborCents, locale)}</p> : null}
              <p className="mt-0.5 text-xs text-muted-foreground" data-testid="truck-costs-labor">{fillPlaceholders(messages.pcCostsLaborHours, { hours: data.laborHours.toLocaleString(locale === 'es' ? 'es-US' : 'en-US', { maximumFractionDigits: 2 }) })}</p>
              {!data.laborRateSet ? <AdminNavLink className="tap-inline text-xs text-primary underline" href="/admin/parts/labor-rate">{messages.pcCostsSetRate}</AdminNavLink> : null}
            </div>
            {/* D34 (LB-2): built; the tile opens the internal invoices instead of saying "coming later". */}
            <AdminNavLink
              href="/admin/parts/internal-invoices"
              className="block rounded-xl border bg-card px-4 py-3 text-muted-foreground hover:bg-accent"
              data-testid="truck-costs-finance"
            >
              <p className="flex items-center gap-1.5 text-xs"><Receipt aria-hidden="true" className="size-3.5" />{messages.pcCostsFinance}</p>
              <p className="mt-1 text-sm">{messages.pcCostsFinanceHint}</p>
            </AdminNavLink>
          </div>

          {!data.entries.length ? (
            <CompactEmpty>{period === 'all' ? fillPlaceholders(messages.pcCostsEmpty, { truck: truckNumber }) : messages.pcCostsEmptyPeriod}</CompactEmpty>
          ) : (
            <>
              <SectionCard title={messages.pcCostsByMonth}>
                <div className="space-y-2 px-4 py-3" data-testid="truck-costs-months">
                  <p className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />{messages.pcCostsParts}</span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/40" />{messages.pcCostsOutside}</span>
                    <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-success/70" />{messages.pcCostsLaborTitle}</span>
                  </p>
                  {data.months.map((month) => (
                    <div key={month.month} className="grid grid-cols-[4rem_1fr_6rem] items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{monthLabel(month.month)}</span>
                      <span className="flex h-3 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
                        <span className="bg-primary" style={{ width: `${(Math.max(0, month.partsCents) / maxMonth) * 100}%` }} />
                        <span className="bg-primary/40" style={{ width: `${(Math.max(0, month.outsideCents) / maxMonth) * 100}%` }} />
                        <span className="bg-success/70" style={{ width: `${(Math.max(0, month.laborCents) / maxMonth) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums">{formatCents(month.partsCents + month.outsideCents + month.laborCents, locale)}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title={messages.pcCostsMovements} count={data.entries.length}>
                <ul className="divide-y" data-testid="truck-costs-entries">
                  {data.entries.map((entry) => {
                    const href = sourceHref(entry, here);
                    return (
                      <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                        <span className="w-24 shrink-0 text-muted-foreground">{formatInvoiceDate(entry.occurredOn, locale)}</span>
                        <Badge variant="outline">{entry.kind === 'outside_repair' ? messages.pcCostsKindOutside : entry.kind === 'labor' ? messages.pcCostsKindLabor : messages.pcCostsKindPart}</Badge>
                        {entry.reversal ? <Badge variant="secondary">{entry.reversal === 'voided' ? messages.pcCostsVoided : messages.pcCostsCorrected}</Badge> : null}
                        {/* PCA4 (UX-10-002): already on an invoice to Finance. */}
                        {entry.chargedOn ? <ChargedOnChip invoice={entry.chargedOn} from={here} messages={messages} /> : null}
                        <span className="min-w-0 flex-1">
                          {href ? <AdminNavLink className="tap-inline hover:underline" href={href}>{entry.description}</AdminNavLink> : entry.description}
                          {entry.workOrder ? (
                            <AdminNavLink className="tap-inline ml-2 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline" href={`/admin/work-orders/${entry.workOrder.id}?from=${encodeURIComponent(here)}`}>{entry.workOrder.displayId}</AdminNavLink>
                          ) : null}
                        </span>
                        <span className={cn('tabular-nums', entry.amountCents < 0 ? 'text-muted-foreground' : 'font-medium')}>{formatCents(entry.amountCents, locale)}</span>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {messages.pcCostsPmNote}{' '}
            <AdminNavLink className="tap-inline underline" href="/admin/parts/purchases">{messages.pcPurchases}</AdminNavLink>
          </p>
        </>
      ) : null}
    </div>
  );
}
