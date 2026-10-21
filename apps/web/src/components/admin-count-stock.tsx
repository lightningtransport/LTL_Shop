'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';
import { formatCents, normalizeCatalogText, parseMoneyToCents, parseQuantityToHundredths, type AdminPartDto, type AdminStockItemDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { useAdminBreadcrumb, useDocumentTitle } from './admin-breadcrumb';
import { kindLabel, partsCostsFailure } from './admin-parts-catalog';
import { stockQty } from './admin-stock-actions';
import { Badge, Button, Card, CardContent, EmptyState, InlineAlert, Input, Label, LoadFailure, PageHeader, PageSkeleton, Select } from './ui';
import { countAdminStockBatch, useAdminPartsCatalog, useAdminStock } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { apiErrorCode } from '@/lib/api-error-message';
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes-guard';

type Row = { part: AdminPartDto; categoryId: string; categoryName: string; kind: AdminStockItemDto['kind']; item: AdminStockItemDto | undefined };

/** A count can be 0; empty means "not counted". */
function countedHundredths(value: string | undefined) {
  if (value === undefined || value.trim() === '') return null;
  if (Number(value) === 0 && /^\s*0+(\.0+)?\s*$/.test(value)) return 0;
  return parseQuantityToHundredths(value) ?? undefined;
}

/**
 * D47 / HU-M20 (LTR-246): Count stock in bulk — the first day and each count. The Manager types what is on the shelf
 * (on the phone, standing at it); each row shows what changes and at what cost. A cost is asked only for a part that
 * goes up with no average and no reference cost. One save; the API writes all or nothing.
 */
export function AdminCountStock({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const { showToast } = useActionToast();
  useDocumentTitle(messages.pcCountStock);
  useAdminBreadcrumb([{ label: messages.pcParts, href: '/admin/parts/catalog' }, { label: messages.pcCountStock }]);
  const { data: catalog, error, isLoading, mutate } = useAdminPartsCatalog('');
  const { data: stockData, mutate: mutateStock } = useAdminStock('all=true');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const stock = useMemo(() => new Map((stockData?.items ?? []).map((item) => [item.partId, item])), [stockData]);
  const rows: Row[] = useMemo(() => (catalog?.categories ?? []).flatMap((category) => category.parts
    .filter((part) => part.active)
    .map((part) => ({ part, categoryId: category.id, categoryName: category.name, kind: category.kind, item: stock.get(part.id) }))), [catalog, stock]);
  const needle = normalizeCatalogText(search);
  const visible = rows.filter((row) => (!kind || row.kind === kind) && (!categoryId || row.categoryId === categoryId)
    && (!needle || normalizeCatalogText(`${row.part.displayName} ${row.part.partNumber ?? ''} ${row.part.tireSize ?? ''}`).includes(needle)));

  /** What a row changes: null when not counted or the same; else the difference and the cost of each one. */
  function change(row: Row) {
    const next = countedHundredths(counted[row.part.id]);
    if (next === null || next === undefined) return null;
    const onHand = Math.round(Number(row.item?.onHand ?? 0) * 100);
    const diff = next - onHand;
    if (diff === 0) return { diff: 0, unit: null as number | null, needsCost: false };
    if (diff < 0) return { diff, unit: row.item?.avgCostCents ?? 0, needsCost: false };
    const typed = parseMoneyToCents(costs[row.part.id] ?? '');
    const unit = (costs[row.part.id]?.trim() ? typed ?? null : null) ?? row.item?.avgCostCents ?? row.part.unitCostCents;
    return { diff, unit, needsCost: unit === null || unit === undefined };
  }

  const changes = rows.map((row) => ({ row, change: change(row) })).filter((entry) => entry.change && entry.change.diff !== 0);
  const invalid = rows.some((row) => countedHundredths(counted[row.part.id]) === undefined);
  const needCost = changes.filter((entry) => entry.change!.needsCost);
  const valueIn = changes.reduce((sum, entry) => sum + (entry.change!.diff > 0 && entry.change!.unit ? Math.round((entry.change!.unit * entry.change!.diff) / 100) : 0), 0);
  const valueOut = changes.reduce((sum, entry) => sum + (entry.change!.diff < 0 ? Math.round(((entry.change!.unit ?? 0) * -entry.change!.diff) / 100) : 0), 0);
  const dirty = Object.values(counted).some((value) => value.trim() !== '');
  useUnsavedChangesGuard(dirty && !busy, messages.unsavedChangesConfirm);
  const canSave = !busy && changes.length > 0 && !needCost.length && !invalid;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setFailure(null);
    try {
      const lines = changes.map(({ row }) => {
        const typed = costs[row.part.id]?.trim() ? parseMoneyToCents(costs[row.part.id]) : undefined;
        return { partId: row.part.id, counted: counted[row.part.id].trim(), ...(typed !== undefined && typed !== null ? { unitCostCents: typed } : {}) };
      });
      const result = await countAdminStockBatch({ lines });
      showToast('success', fillPlaceholders(messages.pcCountSaved, { changed: String(result.changed) }));
      setCounted({});
      setCosts({});
      void mutate();
      await mutateStock();
      router.push('/admin/parts/catalog');
    } catch (cause) {
      if (cause instanceof ApiError && apiErrorCode(cause) === 'STOCK_COST_REQUIRED') {
        setMissing((cause.body as { partIds?: string[] } | undefined)?.partIds ?? []);
      }
      setFailure(partsCostsFailure(cause, messages));
    } finally {
      setBusy(false);
    }
  }

  const setCount = (partId: string, value: string) => setCounted((current) => ({ ...current, [partId]: value }));
  const step = (row: Row, by: number) => {
    const current = countedHundredths(counted[row.part.id]);
    const base = current === null || current === undefined ? Math.round(Number(row.item?.onHand ?? 0) * 100) : current;
    setCount(row.part.id, stockQty(Math.max(0, base + by * 100) / 100));
  };

  function changeText(row: Row) {
    const value = change(row);
    if (countedHundredths(counted[row.part.id]) === null) return <span className="text-muted-foreground">{messages.pcCountNotCounted}</span>;
    if (!value) return null;
    if (value.diff === 0) return <span className="text-muted-foreground">{messages.pcCountNoChange}</span>;
    if (value.needsCost || missing.includes(row.part.id)) {
      return (
        <span className="flex items-center gap-2">
          <Badge variant="secondary" className="border-warning/50 bg-warning/15 text-warning-foreground">{messages.pcCountNeedsCost}</Badge>
          <Input className="w-24 tabular-nums" inputMode="decimal" placeholder={messages.pcCountCostEach} aria-label={`${messages.pcAddToStockCost} · ${row.part.displayName}`} value={costs[row.part.id] ?? ''} onChange={(event) => setCosts((current) => ({ ...current, [row.part.id]: event.target.value }))} />
        </span>
      );
    }
    const qty = stockQty(Math.abs(value.diff) / 100);
    const text = fillPlaceholders(value.diff > 0 ? messages.pcCountUp : messages.pcCountDown, { qty, cost: formatCents(value.unit ?? 0, locale) });
    return <span className="tabular-nums">{text}{value.diff > 0 && !row.item?.avgCostCents && !costs[row.part.id]?.trim() ? <span className="ml-1 text-xs text-muted-foreground">{messages.pcRefShort}</span> : null}</span>;
  }

  if (isLoading && !catalog) return <PageSkeleton label={messages.pcCountStock} />;
  if (error || !catalog) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  return (
    <div className="space-y-4 pb-24">
      <PageHeader title={messages.pcCountStock} subtitle={messages.pcCountStockSubtitle} />
      <Card className="p-3">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.pcStockSearch} aria-label={messages.pcStockSearch} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="count-kind">{messages.pcKindFilter}</Label>
            <Select id="count-kind" value={kind} onChange={(event) => { setKind(event.target.value); setCategoryId(''); }}>
              <option value="">{messages.pcKindAll}</option>
              <option value="pm">{messages.pcKindPm}</option>
              <option value="repair">{messages.pcKindRepair}</option>
              <option value="tire">{messages.pcKindTire}</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="count-category">{messages.pcCountCategory}</Label>
            <Select id="count-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">{messages.pcKindAll}</option>
              {catalog.categories.filter((category) => !kind || category.kind === kind).map((category) => (
                <option key={category.id} value={category.id}>{category.kind === 'pm' ? category.name : `${category.name} · ${kindLabel(category.kind, messages)}`}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {!visible.length ? <EmptyState><p>{messages.pcNoParts}</p></EmptyState> : null}

      {/* Phone: cards with − / + (44 px), the Manager counts standing at the shelf. */}
      <ul className="space-y-2 md:hidden" data-testid="count-cards">
        {visible.map((row) => (
          <li key={row.part.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{row.part.displayName}</p>
                <p className="text-xs text-muted-foreground">{[row.part.partNumber, `${messages.pcCountAppSays} ${stockQty(row.item?.onHand ?? 0)}`].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="outline" className="size-11 p-0" aria-label={`${messages.pcCountMinus} · ${row.part.displayName}`} onClick={() => step(row, -1)}><Minus aria-hidden="true" /></Button>
                <Input className="h-11 w-16 text-center tabular-nums" inputMode="decimal" aria-label={`${messages.pcCountCounted} · ${row.part.displayName}`} value={counted[row.part.id] ?? ''} onChange={(event) => setCount(row.part.id, event.target.value)} />
                <Button type="button" variant="outline" className="size-11 p-0" aria-label={`${messages.pcCountPlus} · ${row.part.displayName}`} onClick={() => step(row, 1)}><Plus aria-hidden="true" /></Button>
              </div>
            </div>
            <div className="mt-1 text-xs">{changeText(row)}</div>
          </li>
        ))}
      </ul>

      {/* Computer: one table. */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full min-w-[640px] text-left text-sm" data-testid="count-table">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="p-2.5">{messages.pcPartName}</th>
              <th className="p-2.5 text-right">{messages.pcCountAppSays}</th>
              <th className="w-32 p-2.5">{messages.pcCountCounted}</th>
              <th className="p-2.5">{messages.pcCountChange}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((row) => (
              <tr key={row.part.id}>
                <td className="p-2.5">
                  <span className="font-medium">{row.part.displayName}</span>
                  <span className="block text-xs text-muted-foreground">{[row.part.partNumber, row.categoryName].filter(Boolean).join(' · ')}</span>
                </td>
                <td className="p-2.5 text-right tabular-nums">{stockQty(row.item?.onHand ?? 0)}</td>
                <td className="p-2.5">
                  <Input className="tabular-nums" inputMode="decimal" aria-label={`${messages.pcCountCounted} · ${row.part.displayName}`} value={counted[row.part.id] ?? ''} onChange={(event) => setCount(row.part.id, event.target.value)} aria-invalid={countedHundredths(counted[row.part.id]) === undefined || undefined} />
                </td>
                <td className="p-2.5">{changeText(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {failure ? <InlineAlert>{failure}</InlineAlert> : null}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-lg" data-testid="count-summary">
        <p className="text-sm tabular-nums">
          <b>{fillPlaceholders(messages.pcCountSummary, { changed: String(changes.length), in: formatCents(valueIn, locale), out: formatCents(valueOut, locale) })}</b>
          {needCost.length ? <span className="ml-2 text-warning-foreground">· {fillPlaceholders(messages.pcCountNeedCostSummary, { count: String(needCost.length) })}</span> : null}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push('/admin/parts/catalog')} disabled={busy}>{messages.cancel}</Button>
          <Button type="button" onClick={() => void save()} disabled={!canSave} data-testid="count-save">{messages.pcCountSave}</Button>
        </div>
      </div>
    </div>
  );
}
