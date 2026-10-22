'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronsUpDown,
  CircleCheck,
  CircleSlash,
  CornerDownRight,
  MoreHorizontal,
  OctagonPause,
  Package,
  PackageCheck,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserPlus,
  Users,
  XCircle,
  Boxes,
  CircleDot,
} from 'lucide-react';
import { formatCents, isPmCategory, isQualityCheckJob, type AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { JobStockDialog } from './admin-job-stock-dialog';
import { JobTiresDialog } from './admin-job-tires-dialog';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { intlLocale } from '@/lib/shop-locale';
import { formatAdminDate } from '@/lib/admin-format';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { jobDisplayName } from '@/lib/job-display-name';
import { useCatalogJobs } from '@/lib/shop-data';
import { formatTime } from '@/lib/work-order-view';
import { cn } from '@/lib/utils';
import { AdminNavLink } from './admin-nav-link';
import { MechanicAvatar } from './mechanic-avatar';
import { MechanicPicker } from './mechanic-picker';
import { ResponsiveMenu, type MenuItem } from './responsive-menu';
import { orderJobs } from '@/lib/work-order-jobs';
import { Button, CompactEmpty, DialogActions, Modal, Select, Textarea } from './ui';

type Job = AdminWorkOrderDetailDto['jobs'][number];
type Mechanic = { id: string; name: string };
type ExternalKind = 'part' | 'truck';
/** LTR-188: the dialogs this table owns besides the row menu (D23 helper, D24 external shop). */
type JobDialog =
  | { kind: 'helper'; jobId: string }
  | { kind: 'external'; jobId: string }
  | { kind: 'return'; jobId: string };

// Stage 8 (mockup): Job (grows) · Mechanic 200px · Status 130px · Action 150px; two lines on phones.
const GRID = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 [@container(min-width:44rem)]:grid-cols-[minmax(12rem,1fr)_minmax(9rem,200px)_130px_150px] [@container(min-width:44rem)]:gap-4';
const STATUS = 'inline-flex items-center gap-1.5 justify-self-end whitespace-nowrap [@container(width<44rem)]:order-1 [@container(width<44rem)]:text-xs [@container(min-width:44rem)]:justify-self-start';

/**
 * LTR-174 / Stage 5 (R3, R5) / Stage 8 (mockup): the Jobs of a Work Order — Job · Mechanic · Status · Action,
 * inside the Jobs card. Open Jobs first, the blocked ones on top and tinted; a helper right under its Job; Jobs
 * at an external shop after the shop's work and Quality Check last. Done and cancelled Jobs are grouped (open by
 * default, muted). The mechanic is a ghost button with the avatar that opens the picker ("Unassign" included,
 * D11); "Complete" is quiet except on Quality Check (D15 / D19); the PM job switches PM A ↔ B from a menu and is
 * finished from the PM service (LTR-145). The row's "…" holds Add helper (D23), Send to external shop (D24),
 * Cancel / Reopen (the reason dialog is the detail's). A Job at an external shop shows where it is and "Returned".
 */
export function AdminJobTable({
  data,
  locale,
  messages,
  canManageJobs,
  canReopenJob,
  pendingAction,
  pmMechanics,
  assignableMechanics,
  onAssign,
  onComplete,
  onPmServiceChange,
  onJobDialog,
  onAddHelper,
  onSendExternal,
  onReturnExternal,
  highlightedJobId = null,
  blockedJobIds = [],
  returnRequest = null,
  onReturnRequestHandled,
  onStockChanged,
}: {
  data: AdminWorkOrderDetailDto;
  locale: AdminLocale;
  messages: AdminMessages;
  canManageJobs: boolean;
  canReopenJob: boolean;
  pendingAction: string | null;
  pmMechanics: Mechanic[];
  assignableMechanics: Mechanic[];
  /** Empty `mechanicId` unassigns. */
  onAssign: (jobId: string, mechanicId: string) => void;
  onComplete: (jobId: string) => void;
  onPmServiceChange: (jobId: string, catalogJobId: string) => void;
  onJobDialog: (kind: 'cancel' | 'reopen', jobId: string) => void;
  onAddHelper?: (jobId: string, mechanicId: string) => void;
  onSendExternal?: (jobId: string, input: { kind: ExternalKind; note: string }) => void;
  onReturnExternal?: (jobId: string, input: { outcome: 'complete' | 'assign'; mechanicId?: string }) => void;
  /** Stage 4 (T4): the Job opened with "Manage in Work Order" (`#job-<id>`), highlighted. */
  highlightedJobId?: string | null;
  /** Stage 5: Jobs with an active mechanic blocker (they go on top). */
  blockedJobIds?: string[];
  /** Stage 8: "Returned" in the Next step opens this table's dialog for that Job. */
  returnRequest?: string | null;
  onReturnRequestHandled?: () => void;
  /** D45 / ST-3: a part left the stock for a Job, or went back; the Work Order reloads. */
  onStockChanged?: () => void;
}) {
  const [dialog, setDialog] = useState<JobDialog | null>(null);
  const [stockJobId, setStockJobId] = useState<string | null>(null);
  // D45 / ST-1: a parts invoice for this Job, with the truck and the Job already picked; saving comes back here.
  const partsInvoiceHref = (jobId: string) => `/admin/parts/purchases?new=1&forTruck=${data.truck.id}&jobId=${jobId}&from=${encodeURIComponent(`/admin/work-orders/${data.id}`)}`;
  const [tiresJobId, setTiresJobId] = useState<string | null>(null);
  const [pickerJobId, setPickerJobId] = useState<string | null>(null);
  // Stage 8 (mockup): the done and cancelled group starts open.
  const [closedOpen, setClosedOpen] = useState(true);
  // Stage 4/5 (T4): the Job asked for with `#job-<id>` comes into view — its group opens if it is done or cancelled.
  useEffect(() => {
    if (!highlightedJobId) return;
    if (data.jobs.some((job) => job.id === highlightedJobId && job.status !== 'to_do')) setClosedOpen(true);
    const timer = window.setTimeout(() => document.getElementById(`job-${highlightedJobId}`)?.scrollIntoView({ block: 'center' }), 50);
    return () => window.clearTimeout(timer);
    // Only when a Job is asked for, not on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedJobId]);
  useEffect(() => {
    if (!returnRequest) return;
    setDialog({ kind: 'return', jobId: returnRequest });
    onReturnRequestHandled?.();
  }, [returnRequest, onReturnRequestHandled]);
  const dialogJob = dialog ? data.jobs.find((job) => job.id === dialog.jobId) : undefined;
  const pending = Boolean(pendingAction);
  const number = new Intl.NumberFormat(intlLocale(locale));
  // LTR-200 / D-PC7: outside shop invoices are money — the Shop Manager and the System Admin only.
  const canSeeCosts = useCanShowManagerWrites();
  const { open, closed } = useMemo(() => orderJobs(data.jobs, blockedJobIds), [data.jobs, blockedJobIds]);

  if (!data.jobs.length) return <p className="px-4 py-6 text-center text-muted-foreground">{messages.jobsEmpty}</p>;

  function rowMenu(job: Job, name: string, items: MenuItem[]) {
    if (!items.length) return <span aria-hidden="true" className="hidden size-8 shrink-0 [@container(min-width:44rem)]:block" />;
    return (
      <ResponsiveMenu
        label={name}
        items={items}
        trigger={(
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 [@container(min-width:44rem)]:size-8"
            aria-label={fillPlaceholders(messages.jobRowActions, { job: name })}
            disabled={pending}
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </button>
        )}
      />
    );
  }

  function openRow(job: Job) {
    const isPmJob = isPmCategory(job.category.name);
    const isQualityCheck = isQualityCheckJob(job.category.name, job.displayName);
    const isExternal = Boolean(job.external);
    const isBlocked = blockedJobIds.includes(job.id);
    const canEdit = canManageJobs;
    const canHelp = canEdit && Boolean(onAddHelper) && canAddHelper(job);
    const canSendOut = canEdit && Boolean(onSendExternal) && !isQualityCheck && !isExternal;
    const name = jobDisplayName(job, messages.helperJobSuffix);
    const parent = job.helperOfJobId ? data.jobs.find((other) => other.id === job.helperOfJobId) : undefined;
    const pmSummary = data.pmService?.workOrderJobId === job.id
      ? messages.pmJobServiceSummary
        .replace('{mileage}', data.pmService.observedMileage === null ? messages.noValue : number.format(data.pmService.observedMileage))
        .replace('{parts}', String(data.pmService.partsCount))
      : null;
    const sub = isPmJob
      ? messages.jobPmSub
      : isQualityCheck
        ? messages.jobQcSub
        : job.helperOfJobId
          ? parent?.assignedMechanic ? fillPlaceholders(messages.jobHelps, { name: parent.assignedMechanic.name }) : messages.jobHelpsMain
          : job.category.name;
    const highlighted = highlightedJobId === job.id;

    const items: MenuItem[] = [];
    if (canHelp) items.push({ key: 'helper', label: messages.addHelperAction, icon: Users, testId: 'admin-wo-job-add-helper', onSelect: () => setDialog({ kind: 'helper', jobId: job.id }) });
    if (canSendOut) items.push({ key: 'external', label: messages.sendExternalAction, icon: Building2, testId: 'admin-wo-job-send-external', onSelect: () => setDialog({ kind: 'external', jobId: job.id }) });
    // LTR-200 / PC-3: the outside shop's invoice for this Job, with the truck and the Job already picked.
    // PCA3 (UX-10-001): also once the Job is back, which is when the invoice usually arrives.
    const outsideInvoiceHref = `/admin/parts/outside-repairs?new=1&forTruck=${data.truck.id}&jobId=${job.id}&from=${encodeURIComponent(`/admin/work-orders/${data.id}`)}`;
    const awaitingInvoice = canSeeCosts && !isExternal && Boolean(job.wentExternal) && !job.outsideInvoices?.length;
    if (canSeeCosts && (isExternal || job.wentExternal || job.outsideInvoices?.length)) {
      items.push({ key: 'outside-invoice', label: messages.pcAddOutsideInvoice, icon: Receipt, testId: 'admin-wo-job-outside-invoice', href: outsideInvoiceHref });
    }
    // D47 / LTR-247: one "Parts…" for everything a Job takes (it replaces "Add parts invoice", "Parts from stock"
    // and "Tires to put"): the inspection's tires, what it has, from stock, and "Buy for this Job".
    if (canSeeCosts && job.status !== 'cancelled') {
      if (onStockChanged) items.push({ key: 'parts', label: messages.pcJobPartsAction, icon: Package, testId: 'admin-wo-job-parts', onSelect: () => setStockJobId(job.id) });
      else items.push({ key: 'parts-invoice', label: messages.pcAddPartsForJob, icon: Package, testId: 'admin-wo-job-parts-invoice', href: partsInvoiceHref(job.id) });
    }
    // D55 R9: the Quality Check is never cancelled.
    if (canEdit && !isQualityCheck) items.push({ key: 'cancel', label: messages.cancelJobAction, icon: XCircle, destructive: true, separatorBefore: items.length > 0, onSelect: () => onJobDialog('cancel', job.id) });

    let mechanic;
    if (isExternal && job.external) {
      const Icon = job.external.kind === 'truck' ? Truck : Package;
      mechanic = (
        <span className="flex h-10 min-w-0 items-center gap-2 text-muted-foreground [@container(width<44rem)]:order-2 [@container(min-width:44rem)]:h-9" title={job.external.note} data-testid="admin-wo-job-external-where">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{job.external.kind === 'truck' ? messages.jobTruckOut : messages.jobPartOut} · {job.external.note}</span>
        </span>
      );
    } else if (isQualityCheck) {
      mechanic = (
        <span className="flex h-10 items-center gap-2 px-2 text-muted-foreground [@container(width<44rem)]:order-2 [@container(width<44rem)]:-ml-2 [@container(min-width:44rem)]:h-9" title={messages.workPlanQcHint}>
          <span className="grid size-6 place-items-center rounded-full border border-dashed border-muted-foreground/60"><ShieldCheck aria-hidden="true" className="size-3.5" /></span>
          Safety
        </span>
      );
    } else if (canEdit) {
      mechanic = (
        <MechanicPicker
          open={pickerJobId === job.id}
          onOpenChange={(next) => setPickerJobId(next ? job.id : null)}
          title={fillPlaceholders(messages.assignJobMechanicFor, { job: job.displayName })}
          mechanics={withCurrentAssignee(isPmJob ? pmMechanics : assignableMechanics, job.assignedMechanic)}
          currentId={job.assignedMechanic?.id ?? null}
          messages={messages}
          onPick={(person) => { setPickerJobId(null); if (person.id !== job.assignedMechanic?.id) onAssign(job.id, person.id); }}
          onUnassign={() => { setPickerJobId(null); onAssign(job.id, ''); }}
          trigger={(
            <button
              type="button"
              className={cn('flex h-11 min-w-0 items-center gap-2 rounded-md px-2 text-left hover:bg-accent disabled:opacity-60 [@container(width<44rem)]:order-2 [@container(width<44rem)]:-ml-2 [@container(width<44rem)]:justify-self-start [@container(min-width:44rem)]:h-9', pendingAction === `assign-job-${job.id}` && 'opacity-60')}
              aria-label={fillPlaceholders(messages.assignJobMechanicFor, { job: job.displayName })}
              disabled={pending}
            >
              {job.assignedMechanic ? (
                <>
                  <MechanicAvatar id={job.assignedMechanic.id} name={job.assignedMechanic.name} size="sm" />
                  <span className="truncate">{job.assignedMechanic.name}</span>
                </>
              ) : (
                <>
                  <span className="grid size-6 place-items-center rounded-full border border-dashed border-muted-foreground/60"><UserPlus aria-hidden="true" className="size-3.5 text-muted-foreground" /></span>
                  <span className="text-muted-foreground">{messages.jobAssignShort}</span>
                </>
              )}
              <ChevronsUpDown aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        />
      );
    } else {
      mechanic = (
        <span className="flex h-10 min-w-0 items-center gap-2 [@container(width<44rem)]:order-2 [@container(min-width:44rem)]:h-9">
          {job.assignedMechanic ? (
            <><MechanicAvatar id={job.assignedMechanic.id} name={job.assignedMechanic.name} size="sm" /><span className="truncate">{job.assignedMechanic.name}</span></>
          ) : <span className="text-muted-foreground">{job.workflowStepKey ? messages.jobInTeamQueue : isPmJob ? messages.pmJobUnassigned : messages.jobUnassigned}</span>}
        </span>
      );
    }

    const status = isExternal ? (
      <span className={cn(STATUS, 'text-primary')} data-testid="admin-wo-job-external" data-status="external"><Building2 aria-hidden="true" className="size-3.5" />{messages.externalStatus}</span>
    ) : isBlocked ? (
      <span className={cn(STATUS, 'text-warning-foreground dark:text-warning')} data-status="blocked"><OctagonPause aria-hidden="true" className="size-3.5" />{messages.blockedShort}</span>
    ) : (
      <span className={cn(STATUS, 'text-muted-foreground')} data-status="to_do"><span aria-hidden="true" className="size-2 rounded-full border-[1.5px] border-muted-foreground" />{messages.jobToDo}</span>
    );

    let action = null;
    if (canEdit) {
      if (isExternal) {
        action = onReturnExternal ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} data-testid="admin-wo-job-returned" onClick={() => setDialog({ kind: 'return', jobId: job.id })}>
            <PackageCheck aria-hidden="true" />
            {pendingAction === `return-external-${job.id}` ? messages.saving : messages.externalReturnedAction}
          </Button>
        ) : null;
      } else if (isPmJob) {
        action = <PmServiceMenu job={job} messages={messages} disabled={pending} onChange={(catalogJobId) => onPmServiceChange(job.id, catalogJobId)} />;
      } else {
        // LTR-164 (#2) / D15 / D19: primary only on Quality Check (the Manager's fallback for Safety); outline elsewhere.
        // G2 (2026-10-06): a borderless "✓ Complete" read as a status ("it is completed"); it is a button with a border
        // and says "Mark complete", so it never looks like the Job's state.
        action = (
          <Button
            type="button"
            size="sm"
            variant={isQualityCheck ? 'default' : 'outline'}
            disabled={pending}
            aria-label={`${messages.completeJobAction}: ${name}`}
            onClick={() => onComplete(job.id)}
          >
            {pendingAction === `complete-job-${job.id}` ? messages.saving : messages.completeJobAction}
          </Button>
        );
      }
    }

    return (
      <li
        key={job.id}
        id={`job-${job.id}`}
        className={cn(
          GRID,
          'scroll-mt-24',
          isBlocked && 'bg-warning/[0.05] shadow-[inset_3px_0_0_var(--warning)]',
          highlighted && 'bg-accent shadow-[inset_3px_0_0_var(--primary)]',
        )}
        data-testid="admin-wo-job-row"
        data-highlighted={highlighted ? 'true' : undefined}
      >
        <div className="flex min-w-0 gap-1.5">
          {job.helperOfJobId ? <CornerDownRight aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
          <div className="min-w-0">
            <p className="font-medium">
              {job.displayName}
              {/* LTR-188 / D23: "· helper" comes from the catalogs, never from the stored name. */}
              {job.helperOfJobId ? <span className="font-normal text-muted-foreground">{messages.helperJobSuffix}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{sub}</p>
            {awaitingInvoice ? (
              <p className="mt-0.5" data-testid="admin-wo-job-awaiting-invoice">
                <AdminNavLink href={outsideInvoiceHref} className="tap-inline inline-flex items-center gap-1 rounded-md border border-warning/50 bg-warning/10 px-1.5 py-0.5 text-xs text-foreground hover:bg-warning/20">
                  <Receipt aria-hidden="true" className="size-3" />
                  {messages.pcJobReturnedNoInvoice}
                </AdminNavLink>
              </p>
            ) : null}
            {canSeeCosts && job.outsideInvoices?.length ? (
              <p className="mt-0.5 flex flex-wrap gap-1" data-testid="admin-wo-job-outside-invoices">
                {job.outsideInvoices.map((invoice) => (
                  <AdminNavLink key={invoice.id} href={`/admin/parts/outside-repairs/${invoice.id}?from=${encodeURIComponent(`/admin/work-orders/${data.id}`)}`} className="tap-inline inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                    <Receipt aria-hidden="true" className="size-3" />
                    {fillPlaceholders(messages.pcJobInvoiceChip, { amount: formatCents(invoice.amountCents, locale), vendor: invoice.vendorName })}
                  </AdminNavLink>
                ))}
              </p>
            ) : null}
            {job.parts?.length ? (
              <p className="mt-0.5 flex flex-wrap gap-1" data-testid="admin-wo-job-parts">
                {job.parts.map((part, at) => {
                  const text = fillPlaceholders(messages.pcJobPartChip, { part: part.description, qty: String(Number(part.quantity)) });
                  const chip = <><Package aria-hidden="true" className="size-3" />{text}{canSeeCosts && part.lineTotalCents !== undefined ? ` · ${formatCents(part.lineTotalCents, locale)}` : ''}</>;
                  return canSeeCosts ? (
                    <AdminNavLink key={at} href={`/admin/parts/purchases/${part.purchaseId}?from=${encodeURIComponent(`/admin/work-orders/${data.id}`)}`} className="tap-inline inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                      {chip}
                    </AdminNavLink>
                  ) : (
                    <span key={at} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">{chip}</span>
                  );
                })}
              </p>
            ) : null}
            {job.tires?.length ? (
              <p className="mt-0.5" data-testid="admin-wo-job-tires-chip">
                {(() => {
                  const pending = job.tires.filter((tire) => tire.status === 'proposed').length;
                  const issued = job.tires.filter((tire) => tire.status === 'issued').length;
                  const toBuy = job.tires.filter((tire) => tire.status === 'to_buy').length;
                  const text = pending
                    ? fillPlaceholders(messages.pcTiresChip, { count: String(pending) })
                    : fillPlaceholders(messages.pcTiresChipDone, { issued: String(issued), toBuy: String(toBuy) });
                  const tone = pending || toBuy ? 'border-warning/50 bg-warning/10 text-foreground' : 'text-muted-foreground';
                  return canSeeCosts && onStockChanged ? (
                    <button type="button" onClick={() => setTiresJobId(job.id)} className={`tap-inline inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-warning/20 ${tone}`}>
                      <CircleDot aria-hidden="true" className="size-3" />{text}
                    </button>
                  ) : (
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs ${tone}`}><CircleDot aria-hidden="true" className="size-3" />{text}</span>
                  );
                })()}
              </p>
            ) : null}
            {job.stockParts?.some((part) => !part.returned) ? (
              <p className="mt-0.5 flex flex-wrap gap-1" data-testid="admin-wo-job-stock-parts">
                {job.stockParts.filter((part) => !part.returned).map((part) => {
                  const text = `${fillPlaceholders(messages.pcJobPartChip, { part: part.description, qty: String(Number(part.quantity)) })}${canSeeCosts && part.valueCents !== undefined ? ` · ${formatCents(part.valueCents, locale)}` : ''}`;
                  return canSeeCosts && onStockChanged ? (
                    <button key={part.movementId} type="button" onClick={() => setStockJobId(job.id)} className="tap-inline inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                      <Boxes aria-hidden="true" className="size-3" />{text}
                    </button>
                  ) : (
                    <span key={part.movementId} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground"><Boxes aria-hidden="true" className="size-3" />{text}</span>
                  );
                })}
              </p>
            ) : null}
            {job.customDescription ? <p className="mt-1 text-muted-foreground">{job.customDescription}</p> : null}
            {isPmJob && job.startedAt ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {messages.pmJobStartedAt.replace('{date}', formatAdminDate(job.startedAt, locale))}
                {pmSummary ? ` · ${pmSummary}` : ''}
              </p>
            ) : null}
          </div>
        </div>
        {mechanic}
        {status}
        <div className="flex items-center justify-end gap-1 [@container(width<44rem)]:order-3">
          {action}
          {rowMenu(job, name, items)}
        </div>
      </li>
    );
  }

  function closedRow(job: Job) {
    const cancelled = job.status === 'cancelled';
    const isPmJob = isPmCategory(job.category.name);
    const name = jobDisplayName(job, messages.helperJobSuffix);
    const canReopen = canReopenJob && cancelled;
    const pmSummary = isPmJob && data.pmService?.workOrderJobId === job.id
      ? messages.pmJobServiceSummary
        .replace('{mileage}', data.pmService.observedMileage === null ? messages.noValue : number.format(data.pmService.observedMileage))
        .replace('{parts}', String(data.pmService.partsCount))
      : null;
    const highlighted = highlightedJobId === job.id;
    const items: MenuItem[] = canReopen ? [{ key: 'reopen', label: messages.reopenJobAction, icon: RotateCcw, onSelect: () => onJobDialog('reopen', job.id) }] : [];
    return (
      <li
        key={job.id}
        id={`job-${job.id}`}
        className={cn(GRID, 'scroll-mt-24 text-muted-foreground', highlighted && 'bg-accent shadow-[inset_3px_0_0_var(--primary)]')}
        data-testid="admin-wo-job-row"
        data-highlighted={highlighted ? 'true' : undefined}
      >
        <div className="min-w-0">
          <p className={cn('font-medium', cancelled ? 'line-through' : 'text-foreground/80')}>
            {job.displayName}
            {job.helperOfJobId ? <span className="font-normal">{messages.helperJobSuffix}</span> : null}
          </p>
          <p className="text-xs">
            {job.category.name}
            {job.completionNotes ? <> · <span className="italic">“{job.completionNotes}”</span></> : null}
            {cancelled && job.cancelledReason ? ` · “${job.cancelledReason}”` : ''}
            {pmSummary ? ` · ${pmSummary}` : ''}
          </p>
        </div>
        <span className="[@container(width<44rem)]:order-2 [@container(width<44rem)]:text-xs [@container(min-width:44rem)]:px-2">
          {cancelled ? '—' : job.completedBy ? <><span className="[@container(min-width:44rem)]:sr-only">{messages.completedByLabel} </span>{job.completedBy.name}</> : '—'}
        </span>
        {cancelled ? (
          <span className={cn(STATUS, 'text-muted-foreground')} data-status="cancelled"><CircleSlash aria-hidden="true" className="size-3.5" />{messages.jobStatusCancelled}</span>
        ) : (
          <span className={cn(STATUS, 'text-success')} data-status="completed"><Check aria-hidden="true" className="size-3.5" />{fillPlaceholders(messages.jobDone, { time: formatTime(job.completedAt, locale) })}</span>
        )}
        <div className="flex justify-end [@container(width<44rem)]:order-3">{items.length ? rowMenu(job, name, items) : null}</div>
      </li>
    );
  }

  const closedLabel = fillPlaceholders(messages.jobsClosedGroup, { count: String(closed.length) });
  return (
    <div className="[container-type:inline-size]">
      <div className="hidden grid-cols-[minmax(12rem,1fr)_minmax(9rem,200px)_130px_150px] gap-4 border-b bg-sunken px-4 py-2 text-xs text-muted-foreground [@container(min-width:44rem)]:grid" aria-hidden="true">
        <span>{messages.jobTableJob}</span>
        <span>{messages.jobTableMechanic}</span>
        <span>{messages.jobTableStatus}</span>
        <span className="text-right">{messages.jobTableAction}</span>
      </div>
      {open.length ? <ul className="divide-y" aria-label={messages.jobs}>{open.map(openRow)}</ul> : null}
      {closed.length ? (
        <>
          <button
            type="button"
            className={cn('flex min-h-11 w-full items-center gap-2 bg-sunken px-4 py-2.5 text-left text-muted-foreground hover:text-foreground', open.length && 'border-t')}
            aria-expanded={closedOpen}
            aria-controls="admin-wo-closed-jobs"
            data-testid="admin-wo-closed-jobs-toggle"
            onClick={() => setClosedOpen(!closedOpen)}
          >
            <CircleCheck aria-hidden="true" className="size-3.5 text-success" />
            {closedLabel}
            <ChevronDown aria-hidden="true" className={cn('ml-auto size-3.5 transition-transform', closedOpen && 'rotate-180')} />
          </button>
          {closedOpen ? <ul id="admin-wo-closed-jobs" className="divide-y border-t" aria-label={closedLabel}>{closed.map(closedRow)}</ul> : null}
        </>
      ) : null}
      {tiresJobId && onStockChanged && data.jobs.some((job) => job.id === tiresJobId) ? (
        <JobTiresDialog
          job={data.jobs.find((job) => job.id === tiresJobId)!}
          locale={locale}
          messages={messages}
          onClose={() => setTiresJobId(null)}
          onChanged={onStockChanged}
        />
      ) : null}
      {stockJobId && onStockChanged && data.jobs.some((job) => job.id === stockJobId) ? (
        <JobStockDialog
          job={data.jobs.find((job) => job.id === stockJobId)!}
          isPm={isPmCategory(data.jobs.find((job) => job.id === stockJobId)!.category.name)}
          buyHref={partsInvoiceHref(stockJobId)}
          locale={locale}
          messages={messages}
          onClose={() => setStockJobId(null)}
          onChanged={onStockChanged}
          onTires={() => { setTiresJobId(stockJobId); setStockJobId(null); }}
        />
      ) : null}
      {dialog?.kind === 'helper' && dialogJob && onAddHelper ? (
        <AddHelperDialog
          job={dialogJob}
          messages={messages}
          mechanics={assignableMechanics.filter((mechanic) => mechanic.id !== dialogJob.assignedMechanic?.id)}
          disabled={pending}
          onClose={() => setDialog(null)}
          onConfirm={(mechanicId) => { setDialog(null); onAddHelper(dialogJob.id, mechanicId); }}
        />
      ) : null}
      {dialog?.kind === 'external' && dialogJob && onSendExternal ? (
        <SendExternalDialog
          job={dialogJob}
          messages={messages}
          disabled={pending}
          onClose={() => setDialog(null)}
          onConfirm={(input) => { setDialog(null); onSendExternal(dialogJob.id, input); }}
        />
      ) : null}
      {dialog?.kind === 'return' && dialogJob && onReturnExternal ? (
        <ReturnExternalDialog
          job={dialogJob}
          messages={messages}
          mechanics={isPmCategory(dialogJob.category.name) ? pmMechanics : assignableMechanics}
          disabled={pending}
          onClose={() => setDialog(null)}
          onConfirm={(input) => { setDialog(null); onReturnExternal(dialogJob.id, input); }}
        />
      ) : null}
    </div>
  );
}

/** LTR-188 / D23: a helper goes on a pending Job that is not the PM job, the Quality Check or a helper Job. */
function canAddHelper(job: Job): boolean {
  return job.status === 'to_do'
    && !job.external
    && !job.helperOfJobId
    && !isPmCategory(job.category.name)
    && !isQualityCheckJob(job.category.name, job.displayName);
}

function AddHelperDialog({ job, messages, mechanics, disabled, onClose, onConfirm }: {
  job: Job;
  messages: AdminMessages;
  mechanics: Mechanic[];
  disabled: boolean;
  onClose: () => void;
  onConfirm: (mechanicId: string) => void;
}) {
  const [mechanicId, setMechanicId] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (mechanicId) onConfirm(mechanicId); };
  return (
    <Modal open title={fillPlaceholders(messages.addHelperTitle, { job: job.displayName })} closeLabel={messages.closeDialog} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit} data-testid="admin-wo-add-helper-dialog">
        <p className="text-sm text-muted-foreground">{fillPlaceholders(messages.addHelperHelp, { job: job.displayName })}</p>
        {mechanics.length ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium">{messages.addHelperMechanic}</span>
            <Select aria-label={messages.addHelperMechanic} value={mechanicId} disabled={disabled} onChange={(event) => setMechanicId(event.target.value)}>
              <option value="">{messages.addHelperChoose}</option>
              {mechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>)}
            </Select>
          </label>
        ) : <CompactEmpty>{messages.addHelperNoMechanics}</CompactEmpty>}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose}>{messages.dialogBack}</Button>
          <Button type="submit" disabled={disabled || !mechanicId}>{messages.addHelperConfirm}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

function SendExternalDialog({ job, messages, disabled, onClose, onConfirm }: {
  job: Job;
  messages: AdminMessages;
  disabled: boolean;
  onClose: () => void;
  onConfirm: (input: { kind: ExternalKind; note: string }) => void;
}) {
  const [kind, setKind] = useState<ExternalKind>('part');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!note.trim()) { setError(messages.sendExternalNoteRequired); return; }
    onConfirm({ kind, note: note.trim() });
  };
  return (
    <Modal open title={fillPlaceholders(messages.sendExternalTitle, { job: job.displayName })} closeLabel={messages.closeDialog} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit} data-testid="admin-wo-send-external-dialog">
        <p className="text-sm text-muted-foreground">{messages.sendExternalHelp}</p>
        <fieldset className="space-y-1" disabled={disabled}>
          <legend className="text-sm font-medium">{messages.sendExternalWhat}</legend>
          {([['part', messages.sendExternalPart], ['truck', messages.sendExternalTruck]] as const).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="radio" name={`external-kind-${job.id}`} value={value} checked={kind === value} onChange={() => setKind(value)} />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{messages.sendExternalNote}</span>
          <Textarea
            aria-label={messages.sendExternalNote}
            rows={3}
            maxLength={1000}
            value={note}
            disabled={disabled}
            onChange={(event) => { setNote(event.target.value); setError(null); }}
          />
        </label>
        {error ? <p className="text-sm font-medium text-destructive-text" role="alert">{error}</p> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose}>{messages.dialogBack}</Button>
          <Button type="submit" disabled={disabled}>{messages.sendExternalConfirm}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

function ReturnExternalDialog({ job, messages, mechanics, disabled, onClose, onConfirm }: {
  job: Job;
  messages: AdminMessages;
  mechanics: Mechanic[];
  disabled: boolean;
  onClose: () => void;
  onConfirm: (input: { outcome: 'complete' | 'assign'; mechanicId?: string }) => void;
}) {
  const [outcome, setOutcome] = useState<'complete' | 'assign'>('complete');
  const [mechanicId, setMechanicId] = useState('');
  const ready = outcome === 'complete' || Boolean(mechanicId);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    onConfirm(outcome === 'assign' ? { outcome, mechanicId } : { outcome });
  };
  return (
    <Modal open title={fillPlaceholders(messages.externalReturnTitle, { job: job.displayName })} closeLabel={messages.closeDialog} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit} data-testid="admin-wo-return-external-dialog">
        {job.external?.note ? <p className="text-sm text-muted-foreground">{job.external.note}</p> : null}
        <fieldset className="space-y-1" disabled={disabled}>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name={`external-return-${job.id}`} value="complete" checked={outcome === 'complete'} onChange={() => setOutcome('complete')} />
            {messages.externalReturnComplete}
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name={`external-return-${job.id}`} value="assign" checked={outcome === 'assign'} onChange={() => setOutcome('assign')} />
            {messages.externalReturnAssign}
          </label>
        </fieldset>
        {outcome === 'assign' ? (
          <Select aria-label={messages.externalReturnAssign} value={mechanicId} disabled={disabled} onChange={(event) => setMechanicId(event.target.value)}>
            <option value="">{messages.addHelperChoose}</option>
            {mechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>)}
          </Select>
        ) : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose}>{messages.dialogBack}</Button>
          <Button type="submit" disabled={disabled || !ready}>{messages.externalReturnConfirm}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

/** Keep the current owner selectable even when they are no longer in the assignable list. */
function withCurrentAssignee(mechanics: Mechanic[], current: Mechanic | null | undefined): Mechanic[] {
  if (!current || mechanics.some((mechanic) => mechanic.id === current.id)) return mechanics;
  return [current, ...mechanics];
}

/** LTR-145: PM A ↔ PM B for the PM job (PM Category catalog jobs), as a menu button ("PM A ⌄"). */
function PmServiceMenu({ job, messages, disabled, onChange }: {
  job: Job;
  messages: AdminMessages;
  disabled: boolean;
  onChange: (catalogJobId: string) => void;
}) {
  const { data: pmJobs } = useCatalogJobs(job.category.id, true);
  const options = (pmJobs ?? []).filter((item) => /^PM [A-Z] Service$/i.test(item.displayName) || item.id === job.catalogJobId);
  const short = (name: string) => name.replace(/ Service$/i, '');
  if (options.length < 2) return null;
  return (
    <ResponsiveMenu
      label={messages.pmServiceMenu}
      items={options.map((item) => ({
        key: item.id,
        label: item.displayName,
        icon: item.id === job.catalogJobId ? Check : undefined,
        onSelect: () => { if (item.id !== job.catalogJobId) onChange(item.id); },
      }))}
      trigger={(
        <Button type="button" size="sm" variant="outline" aria-label={messages.pmServiceVariant} title={messages.pmJobCompletedFromPmService} disabled={disabled}>
          {short(job.displayName)}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      )}
    />
  );
}
