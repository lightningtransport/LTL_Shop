'use client';

import { forwardRef, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Power, X } from 'lucide-react';
import {
  centsToInput,
  formatCents,
  parseMoneyToCents,
  type AdminPartCategoryDto,
  type AdminPartDto,
  type AdminPartFitDto,
  type AdminVendorDto,
  type PartKind,
  type TireType,
} from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { ResponsiveMenu, type MenuItem } from './responsive-menu';
import {
  Badge, Button, Card, CardContent, DataTable, DialogActions, EmptyState, InlineAlert, Input, Label, LoadFailure, Modal,
  PageHeader, PageSkeleton, SectionCard, Select,
} from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { createAdminPart, createAdminPartCategory, updateAdminPart, useAdminPartsCatalog, useAdminVendors } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { apiErrorCode } from '@/lib/api-error-message';
import { adminWriteFailureMessage } from '@/lib/system-admin';
import { formatInvoiceDate } from '@/lib/parts-costs-format';
import { formatShortDateTime } from '@/lib/work-order-view';
import { useDebouncedFilterText, useUrlFilters } from '@/lib/use-url-filters';
import { useDocumentTitle } from './admin-breadcrumb';

const CATALOG_FILTERS = { q: '', kind: '', make: '', includeInactive: false };

export function partsCostsFailure(failure: unknown, messages: AdminMessages) {
  if (failure instanceof ApiError && apiErrorCode(failure) === 'PART_IN_OPEN_PM') {
    const truck = (failure.body as { openPms?: Array<{ truckNumber: string }> } | undefined)?.openPms?.[0]?.truckNumber;
    if (truck) return fillPlaceholders(messages.pcInOpenPmHelp, { truck });
  }
  if (failure instanceof ApiError && apiErrorCode(failure) === 'PART_NUMBER_EXISTS') {
    const body = failure.body as { partName?: string; categoryName?: string; message?: string } | undefined;
    const number = body?.message?.match(/Part number (.+?) is already/)?.[1] ?? '';
    if (body?.partName) return fillPlaceholders(messages.pcPartNumberTaken, { number, name: body.partName, category: body.categoryName ?? '' });
  }
  if (failure instanceof ApiError && apiErrorCode(failure) === 'PART_CATEGORY_EXISTS') {
    const name = (failure.body as { categoryName?: string } | undefined)?.categoryName;
    if (name) return fillPlaceholders(messages.pcCategoryExists, { name });
  }
  if (failure instanceof ApiError && apiErrorCode(failure) === 'TIRE_FIELDS_REQUIRED') return messages.pcTireNeedsFields;
  if (failure instanceof ApiError && apiErrorCode(failure) === 'VENDOR_NAME_TAKEN') {
    const name = (failure.body as { vendorName?: string } | undefined)?.vendorName;
    if (name) return fillPlaceholders(messages.pcVendorNameTaken, { name });
  }
  return adminWriteFailureMessage(failure, {
    locale: messages.locale,
    apiError: messages.apiError,
    forbidden: messages.pcWriteForbidden,
    conflict: messages.pcWriteConflict,
    failed: messages.pcWriteFailed,
  });
}

/** D45 / ST-2: "Repair", "Tires" (PM categories carry no label). */
export function kindLabel(kind: PartKind, messages: AdminMessages) {
  return kind === 'tire' ? messages.pcKindTire : kind === 'repair' ? messages.pcKindRepair : messages.pcKindPm;
}

/** D45 / ST-2: "11R22.5 · Recap". */
export function tireLabel(part: { tireSize: string | null; tireType: TireType | null }, messages: AdminMessages) {
  if (!part.tireSize && !part.tireType) return '';
  return [part.tireSize, part.tireType === 'new' ? messages.pcTireNew : part.tireType === 'recap' ? messages.pcTireRecap : null].filter(Boolean).join(' · ');
}

/** "All trucks", "Volvo", "Freightliner Cascadia". */
export function fitsLabel(fits: AdminPartFitDto[], messages: AdminMessages) {
  if (!fits.length) return messages.pcAllTrucks;
  return fits.map((fit) => [fit.make, fit.model].filter(Boolean).join(' ')).join(', ');
}

const MenuTrigger = forwardRef<HTMLButtonElement, { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function MenuTrigger({ label, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:size-8"
        aria-label={label}
        {...props}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>
    );
  },
);

/**
 * LTR-200 / D32 (PC-1): Parts & costs → Parts. The PM's own catalog, grouped by the PM categories, with the
 * reference cost ("No cost yet" when missing), the usual vendor and "Fits". A part picked in a PM in progress says
 * so and cannot be turned off or lose that truck (A54). Mechanics never reach this page (D-PC7).
 */
export function AdminPartsCatalog({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
  useDocumentTitle(messages.pcPartsTitle);
  // PCA1 (UX-5-001): the filters live in the URL, so Back and a reload keep them.
  const { filters, set, clear, query, active: filtered } = useUrlFilters(CATALOG_FILTERS);
  const [search, setSearch] = useDebouncedFilterText(filters.q, (next) => set('q', next));
  const { data, error, isLoading, mutate } = useAdminPartsCatalog(query);
  const { data: vendors } = useAdminVendors();
  const [editing, setEditing] = useState<AdminPartDto | 'new' | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const categories = (data?.categories ?? []).filter((category) => category.parts.length || !filtered);
  const partCount = categories.reduce((sum, category) => sum + category.parts.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={messages.pcPartsTitle}
        subtitle={messages.pcPartsSubtitle}
        actions={canWrite && data ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setAddingCategory(true)} data-testid="add-part-category"><Plus aria-hidden="true" />{messages.pcAddCategory}</Button>
            <Button type="button" onClick={() => setEditing('new')}><Plus aria-hidden="true" />{messages.pcAddPart}</Button>
          </div>
        ) : null}
      />
      {data && data.costedPartCount === 0 ? (
        <p className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm" data-testid="parts-first-use">{messages.pcFirstUse}</p>
      ) : null}
      <Card className="p-3">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={messages.pcSearchParts} aria-label={messages.pcSearchParts} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="parts-kind-filter">{messages.pcKindFilter}</Label>
            <Select id="parts-kind-filter" value={filters.kind} onChange={(event) => set('kind', event.target.value)}>
              <option value="">{messages.pcKindAll}</option>
              <option value="pm">{messages.pcKindPm}</option>
              <option value="repair">{messages.pcKindRepair}</option>
              <option value="tire">{messages.pcKindTire}</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="parts-fits-filter">{messages.pcFitsFilter}</Label>
            <Select id="parts-fits-filter" value={filters.make} onChange={(event) => set('make', event.target.value)}>
              <option value="">{messages.pcFitsAny}</option>
              {(data?.truckMakes ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={filters.includeInactive} onChange={(event) => set('includeInactive', event.target.checked)} />
            {messages.pcShowInactive}
          </label>
        </CardContent>
      </Card>

      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.pcPartsTitle} header={false} /> : null}
      {data && filtered && partCount === 0 ? (
        <EmptyState>
          <p>{messages.pcNoParts}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={clear}>{messages.pcClearFilters}</Button>
        </EmptyState>
      ) : null}

      {categories.map((category) => (
        <SectionCard key={category.id} title={category.kind === 'pm' ? category.name : `${category.name} · ${kindLabel(category.kind, messages)}`} count={category.parts.length} data-testid="parts-category">
          {category.parts.length ? (
            <PartsTable category={category} canWrite={canWrite} locale={locale} messages={messages} onEdit={setEditing} onChanged={() => void mutate()} />
          ) : null}
        </SectionCard>
      ))}
      {data ? <p className="text-xs text-muted-foreground">{messages.pcNoCostNote}</p> : null}

      {editing && data ? (
        <PartDialog
          part={editing === 'new' ? null : editing}
          categories={data.categories}
          truckMakes={data.truckMakes}
          vendors={vendors ?? []}
          locale={locale}
          messages={messages}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void mutate(); }}
        />
      ) : null}
      {addingCategory ? (
        <CategoryDialog messages={messages} onClose={() => setAddingCategory(false)} onSaved={() => { setAddingCategory(false); void mutate(); }} />
      ) : null}
    </div>
  );
}

/** D45 / ST-2: a repair or tire category (the PM categories come from the base list). */
function CategoryDialog({ messages, onClose, onSaved }: { messages: AdminMessages; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useActionToast();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'repair' | 'tire'>('repair');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createAdminPartCategory({ name: name.trim(), kind });
      showToast('success', messages.pcCategoryAdded);
      onSaved();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title={messages.pcAddCategory} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!name.trim()}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)} data-testid="category-dialog">
        <div className="space-y-1.5">
          <Label htmlFor="category-name">{messages.pcCategoryName}</Label>
          <Input id="category-name" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} autoComplete="off" required />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{messages.pcCategoryKind}</legend>
          {(['repair', 'tire'] as const).map((value) => (
            <label key={value} className="flex items-start gap-2 text-sm">
              <input type="radio" name="category-kind" className="mt-1" checked={kind === value} onChange={() => setKind(value)} disabled={busy} />
              <span>{kindLabel(value, messages)}<span className="block text-xs text-muted-foreground">{value === 'tire' ? messages.pcKindTireHelp : messages.pcKindRepairHelp}</span></span>
            </label>
          ))}
        </fieldset>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={busy || !name.trim()}>{messages.pcAddCategory}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

function PartsTable({ category, canWrite, locale, messages, onEdit, onChanged }: {
  category: AdminPartCategoryDto;
  canWrite: boolean;
  locale: AdminLocale;
  messages: AdminMessages;
  onEdit: (part: AdminPartDto) => void;
  onChanged: () => void;
}) {
  return (
    <DataTable
      className="md:rounded-none md:border-0"
      items={category.parts}
      caption={category.name}
      getKey={(part) => part.id}
      getRowLabel={(part) => part.displayName}
      columns={[
        {
          key: 'part',
          header: messages.pcPartName,
          primary: true,
          cell: (part) => (
            <div className={part.active ? undefined : 'text-muted-foreground'}>
              <span className="font-medium">{part.displayName}</span>
              {part.partNumber ? <span className="ml-2 font-mono text-xs text-muted-foreground">{part.partNumber}</span> : null}
              {!part.active ? <Badge variant="secondary" className="ml-2">{messages.pcInactive}</Badge> : null}
              {tireLabel(part, messages) ? <span className="mt-0.5 block text-xs text-muted-foreground" data-testid="part-tire">{tireLabel(part, messages)}</span> : null}
              {part.openPms.length ? (
                <span className="mt-0.5 block text-xs text-warning-foreground dark:text-warning">
                  {fillPlaceholders(messages.pcInOpenPm, { truck: part.openPms.map((pm) => pm.truckNumber).join(', ') })}
                </span>
              ) : null}
            </div>
          ),
        },
        { key: 'fits', header: messages.pcFits, cell: (part) => fitsLabel(part.fits, messages) },
        {
          key: 'cost',
          header: messages.pcRefCost,
          cell: (part) => (
            <span>
              {part.unitCostCents === null
                ? <span className="text-xs text-muted-foreground">{messages.pcNoCostYet}</span>
                : <span className="tabular-nums">{formatCents(part.unitCostCents, locale)}</span>}
              {part.lastPaid ? (
                <span className="block text-xs text-muted-foreground" data-testid="part-last-paid">
                  {fillPlaceholders(messages.pcLastPaid, { amount: formatCents(part.lastPaid.unitCostCents, locale), date: formatInvoiceDate(part.lastPaid.invoiceDate, locale), vendor: part.lastPaid.vendorName })}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          key: 'vendor',
          header: messages.pcUsualVendor,
          cell: (part) => part.defaultVendor?.name ?? <span className="text-muted-foreground">{messages.pcNoVendor}</span>,
        },
        ...(category.kind === 'pm' ? [{
          key: 'used',
          header: messages.pcUsedInPms,
          cell: (part: AdminPartDto) => (
            <span className="tabular-nums" title={part.lastUsedAt ? formatShortDateTime(part.lastUsedAt, locale) : undefined}>{part.usedInPmCount}</span>
          ),
        }] : []),
        ...(canWrite ? [{
          key: 'actions',
          header: '',
          cell: (part: AdminPartDto) => <div className="flex justify-end"><PartMenu part={part} messages={messages} onEdit={() => onEdit(part)} onChanged={onChanged} /></div>,
        }] : []),
      ]}
    />
  );
}

function PartMenu({ part, messages, onEdit, onChanged }: { part: AdminPartDto; messages: AdminMessages; onEdit: () => void; onChanged: () => void }) {
  const { showToast } = useActionToast();
  async function toggle() {
    try {
      await updateAdminPart(part.id, { active: !part.active });
      showToast('success', messages.pcPartSaved);
      onChanged();
    } catch (failure) {
      showToast('error', partsCostsFailure(failure, messages));
    }
  }
  const items: Array<MenuItem | null> = [
    { key: 'edit', label: messages.pcEditPart, icon: Pencil, onSelect: onEdit },
    // A54: the reason shows before anything is sent.
    part.active && part.openPms.length
      ? { key: 'deactivate', label: messages.pcDeactivate, icon: Power, onSelect: () => showToast('error', fillPlaceholders(messages.pcInOpenPmHelp, { truck: part.openPms[0].truckNumber })) }
      : { key: 'toggle', label: part.active ? messages.pcDeactivate : messages.pcActivate, icon: Power, onSelect: () => void toggle() },
  ];
  return (
    <ResponsiveMenu
      label={part.displayName}
      items={items.filter(Boolean) as MenuItem[]}
      trigger={<MenuTrigger label={fillPlaceholders(messages.pcRowActions, { name: part.displayName })} />}
    />
  );
}

type FitRow = { make: string; model: string };

/**
 * Add or edit a part. D45 / ST-2: a tire category asks for size and New or Recap; every part can have a minimum in
 * stock. `preset` comes from an "Other" purchase line (HU-R2): its name and number, and a repair category first.
 */
export function PartDialog({ part, categories, truckMakes, vendors, locale, messages, onClose, onSaved, preset }: {
  part: AdminPartDto | null;
  categories: AdminPartCategoryDto[];
  truckMakes: string[];
  vendors: AdminVendorDto[];
  locale: AdminLocale;
  messages: AdminMessages;
  onClose: () => void;
  onSaved: (id: string) => void;
  preset?: { displayName: string; partNumber?: string | null };
}) {
  const { showToast } = useActionToast();
  const firstCategory = preset ? categories.find((category) => category.kind === 'repair') ?? categories[0] : categories[0];
  const [categoryId, setCategoryId] = useState(part?.categoryId ?? firstCategory?.id ?? '');
  const [partNumber, setPartNumber] = useState(part?.partNumber ?? preset?.partNumber ?? '');
  const [displayName, setDisplayName] = useState(part?.displayName ?? preset?.displayName ?? '');
  const [tireSize, setTireSize] = useState(part?.tireSize ?? '');
  const [tireType, setTireType] = useState<TireType | ''>(part?.tireType ?? '');
  const [minStock, setMinStock] = useState(part?.minStock !== null && part?.minStock !== undefined ? String(part.minStock) : '');
  const [allTrucks, setAllTrucks] = useState(!part || part.fits.length === 0);
  const [fits, setFits] = useState<FitRow[]>(part?.fits.length ? part.fits.map((fit) => ({ make: fit.make ?? '', model: fit.model ?? '' })) : [{ make: truckMakes[0] ?? '', model: '' }]);
  const [cost, setCost] = useState(centsToInput(part?.unitCostCents));
  const [vendorId, setVendorId] = useState(part?.defaultVendor?.id ?? '');
  const [active, setActive] = useState(part?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costCents = parseMoneyToCents(cost);
  const costInvalid = costCents === undefined;
  const cleanFits = fits.filter((fit) => fit.make.trim() || fit.model.trim()).map((fit) => ({ make: fit.make.trim() || null, model: fit.model.trim() || null }));
  const fitsMissing = !allTrucks && cleanFits.length === 0;
  const lockedByPm = Boolean(part?.openPms.length);
  const vendorChoices = vendors.filter((vendor) => (vendor.active && vendor.doesParts) || vendor.id === vendorId);
  const makeChoices = [...new Set([...truckMakes, ...fits.map((fit) => fit.make).filter(Boolean)])];
  const kind = categories.find((category) => category.id === categoryId)?.kind ?? 'pm';
  const isTire = kind === 'tire';
  const minStockValue = minStock.trim() === '' ? null : /^\d+$/.test(minStock.trim()) ? Number(minStock.trim()) : undefined;
  const tireMissing = isTire && (!tireSize.trim() || !tireType);
  const canSave = !busy && displayName.trim() && categoryId && !costInvalid && !fitsMissing && minStockValue !== undefined && !tireMissing;
  const dirty = part
    ? displayName !== part.displayName || partNumber !== (part.partNumber ?? '') || cost !== centsToInput(part.unitCostCents) || vendorId !== (part.defaultVendor?.id ?? '') || active !== part.active
      || tireSize !== (part.tireSize ?? '') || tireType !== (part.tireType ?? '') || minStock !== (part.minStock !== null ? String(part.minStock) : '')
    : Boolean(displayName.trim() || partNumber.trim() || cost.trim() || tireSize.trim() || minStock.trim());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const body = {
      partNumber: partNumber.trim() || null,
      displayName: displayName.trim(),
      fits: allTrucks ? [] : cleanFits,
      unitCostCents: costCents ?? null,
      defaultVendorId: vendorId || null,
      minStock: minStockValue ?? null,
      ...(isTire ? { tireSize: tireSize.trim(), tireType: tireType || null } : {}),
    };
    try {
      const saved = part ? await updateAdminPart(part.id, { ...body, active }) : await createAdminPart({ ...body, categoryId });
      showToast('success', part ? messages.pcPartSaved : messages.pcPartAdded);
      onSaved(saved.id);
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={part ? messages.pcEditPart : messages.pcAddPart} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!dirty}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)} data-testid="part-dialog">
        {part ? (
          <p className="text-xs text-muted-foreground">
            {part.usedInPmCount && part.lastUsedAt
              ? fillPlaceholders(messages.pcUsedInPmsLine, { count: String(part.usedInPmCount), date: formatShortDateTime(part.lastUsedAt, locale) })
              : messages.pcNeverUsed}
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="part-category">{messages.pcCategory}</Label>
            <Select id="part-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={busy}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.kind === 'pm' ? category.name : `${category.name} · ${kindLabel(category.kind, messages)}`}</option>)}
            </Select>
          </div>
        )}
        {lockedByPm ? <InlineAlert className="border-warning/40 bg-warning-surface text-warning-foreground">{fillPlaceholders(messages.pcInOpenPmHelp, { truck: part!.openPms.map((pm) => pm.truckNumber).join(', ') })}</InlineAlert> : null}
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="part-number">{messages.pcPartNumber}</Label>
            <Input id="part-number" className="font-mono" value={partNumber} onChange={(event) => setPartNumber(event.target.value)} disabled={busy} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-name">{messages.pcPartName}</Label>
            <Input id="part-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={busy} autoComplete="off" required />
          </div>
        </div>

        {isTire ? (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="part-tire-fields">
            <div className="space-y-1.5">
              <Label htmlFor="part-tire-size">{messages.pcTireSize}</Label>
              <Input id="part-tire-size" className="font-mono" value={tireSize} onChange={(event) => setTireSize(event.target.value)} disabled={busy} autoComplete="off" placeholder="11R22.5" aria-describedby="part-tire-size-help" />
              <p id="part-tire-size-help" className="text-xs text-muted-foreground">{messages.pcTireSizeHelp}</p>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">{messages.pcTireType}</legend>
              <div className="flex gap-4">
                {(['new', 'recap'] as const).map((value) => (
                  <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="radio" name="part-tire-type" checked={tireType === value} onChange={() => setTireType(value)} disabled={busy} />
                    {value === 'new' ? messages.pcTireNew : messages.pcTireRecap}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{messages.pcFits}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="part-fits" checked={allTrucks} onChange={() => setAllTrucks(true)} disabled={busy} />
            {messages.pcFitsAllTrucks}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="part-fits" checked={!allTrucks} onChange={() => setAllTrucks(false)} disabled={busy} />
            {messages.pcFitsSomeTrucks}
          </label>
          {!allTrucks ? (
            <div className="space-y-2 pl-6">
              {fits.map((fit, index) => (
                <div key={index} className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`part-fit-make-${index}`} className="text-xs">{messages.pcFitsMake}</Label>
                    <Select id={`part-fit-make-${index}`} value={fit.make} disabled={busy} onChange={(event) => setFits(fits.map((row, at) => at === index ? { ...row, make: event.target.value } : row))}>
                      <option value="">—</option>
                      {makeChoices.map((value) => <option key={value} value={value}>{value}</option>)}
                    </Select>
                  </div>
                  <div className="min-w-32 flex-1 space-y-1">
                    <Label htmlFor={`part-fit-model-${index}`} className="text-xs">{messages.pcFitsModel}</Label>
                    <Input id={`part-fit-model-${index}`} value={fit.model} disabled={busy} autoComplete="off" onChange={(event) => setFits(fits.map((row, at) => at === index ? { ...row, model: event.target.value } : row))} />
                  </div>
                  <Button type="button" variant="ghost" size="sm" aria-label={fillPlaceholders(messages.pcFitsRemoveRow, { make: fit.make || fit.model || '—' })} disabled={busy || fits.length === 1} onClick={() => setFits(fits.filter((_, at) => at !== index))}>
                    <X aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setFits([...fits, { make: '', model: '' }])}><Plus aria-hidden="true" />{messages.pcFitsAddRow}</Button>
              {fitsMissing ? <p className="text-xs text-destructive-text">{messages.pcFitsNeedOne}</p> : null}
            </div>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="part-cost">{messages.pcRefCost}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">$</span>
              <Input id="part-cost" className="pl-7 tabular-nums" inputMode="decimal" placeholder="0.00" value={cost} onChange={(event) => setCost(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={costInvalid || undefined} aria-describedby="part-cost-help" />
            </div>
            <p id="part-cost-help" className={costInvalid ? 'text-xs text-destructive-text' : 'text-xs text-muted-foreground'}>{costInvalid ? messages.pcCostInvalid : messages.pcCostHelp}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-vendor">{messages.pcUsualVendor}</Label>
            <Select id="part-vendor" value={vendorId} onChange={(event) => setVendorId(event.target.value)} disabled={busy}>
              <option value="">{messages.pcNoVendor}</option>
              {vendorChoices.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5 sm:max-w-56">
          <Label htmlFor="part-min-stock">{messages.pcMinStock}</Label>
          <Input id="part-min-stock" inputMode="numeric" className="tabular-nums" value={minStock} onChange={(event) => setMinStock(event.target.value)} disabled={busy} autoComplete="off" aria-invalid={minStockValue === undefined || undefined} aria-describedby="part-min-stock-help" />
          <p id="part-min-stock-help" className={minStockValue === undefined ? 'text-xs text-destructive-text' : 'text-xs text-muted-foreground'}>{messages.pcMinStockHelp}</p>
        </div>

        {part ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={active} disabled={busy || (lockedByPm && active)} onChange={(event) => setActive(event.target.checked)} />
            <span>{messages.pcActive}<span className="block text-xs text-muted-foreground">{messages.pcPartActiveHelp}</span></span>
          </label>
        ) : null}

        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={!canSave}>{part ? messages.pcSaveChanges : messages.pcAddPart}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
