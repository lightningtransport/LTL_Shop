'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  InspectionItemResult,
  InspectionSection,
  TIRE_POSITIONS,
  TireReadingStatus,
  tireAxle,
  tireTargets,
  type InspectionChecklistItemDto,
  type TirePosition,
  type TruckInspectionDto,
  type TruckInspectionStateDto,
} from '@ltl-shop/shared';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  CircleDot,
  Eye,
  Info,
  LayoutGrid,
  List,
  Lock,
  MessageSquare,
  Minus,
  OctagonAlert,
  PenLine,
  Plus,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { ApiError } from '@/lib/api';
import { inspectionCopy, type InspectionCopy, type InspectionLocale } from '@/lib/inspection-copy';
import { addTruckInspectionDefects, saveTruckInspection, useTruckInspection, type InspectionMode } from '@/lib/inspection-data';
import {
  EMPTY_DRAFT,
  inspectionDraftKey,
  parseDraft,
  previewInspection,
  sheetProgress,
  tireStatusOf,
  type PreviewJob,
  type SheetDraft,
  type TireAnswer,
} from '@/lib/inspection-view';
import { useAuth } from '@/lib/auth-context';
import { useLocalDraft } from '@/lib/local-draft';
import { cn } from '@/lib/utils';
import { NextStepCallout } from './next-step-callout';
import { Badge, Button, CountChip, LoadFailure, Modal, PageSkeleton, SectionCard, Textarea } from './ui';

/**
 * D41 / HU-M16 / HU-ME7: the inspection sheet (mockup `docs/proposals/inspection-checklist/mockup.html`).
 * Sheet → Review → Save; once saved it is a read-only report with "Add defects", which reopens the sheet only to
 * turn ok / n/a checks into defects. The Manager and a mechanic with "Can inspect trucks" use the same screen.
 */
export type InspectionSheetProps = {
  mode: InspectionMode;
  truckId: string;
  locale: InspectionLocale;
  /** Where the Truck or My work is (after saving, and from the report). */
  doneHref: string;
  /** Manager only: who can do a new Job. */
  standardMechanics?: ReadonlyArray<{ id: string; name: string }>;
  /** Shows a short confirmation (the app's toast). */
  onSaved?: (message: string) => void;
  /** Left padding of the fixed bar (the Admin sidebar). */
  barClassName?: string;
};

const SECTIONS: Array<{ key: InspectionSection; label: (copy: InspectionCopy) => string }> = [
  { key: InspectionSection.INTERIOR, label: (copy) => copy.sectionInterior },
  { key: InspectionSection.ENGINE, label: (copy) => copy.sectionEngine },
  { key: InspectionSection.EXTERIOR, label: (copy) => copy.sectionExterior },
];

const AXLES: Array<{ key: 'steer' | 'd1' | 'd2'; left: TirePosition[]; right: TirePosition[] }> = [
  { key: 'steer', left: ['LF' as TirePosition], right: ['RF' as TirePosition] },
  { key: 'd1', left: ['LFO', 'LFI'] as TirePosition[], right: ['RFI', 'RFO'] as TirePosition[] },
  { key: 'd2', left: ['LRO', 'LRI'] as TirePosition[], right: ['RRI', 'RRO'] as TirePosition[] },
];

type Tone = 'empty' | 'ok' | 'watch' | 'fix';
const TIRE_TONE: Record<Tone, string> = {
  empty: 'border-dashed bg-background text-muted-foreground',
  ok: 'border-success/40 bg-success/10',
  watch: 'border-warning/50 bg-warning-surface/70',
  fix: 'border-destructive/50 bg-destructive/15',
};
const TIRE_TEXT: Record<Tone, string> = {
  empty: 'text-muted-foreground',
  ok: 'text-success',
  watch: 'text-warning-foreground dark:text-warning',
  fix: 'text-destructive-text',
};
// UX-2-003: the dots use the text tones, which reach 3:1 in both themes (the `destructive` fill is near black in dark).
const DOT: Record<Tone, string> = { empty: 'bg-border', ok: 'bg-success', watch: 'bg-warning-foreground dark:bg-warning', fix: 'bg-destructive-text' };
// UX-2-003: a second sign besides the color, so OK / Watch / Fix read without telling green, amber and red apart.
const TIRE_ICON: Record<Tone, typeof Check | null> = { empty: null, ok: Check, watch: Eye, fix: OctagonAlert };

function tireStateLabel(tone: Tone, copy: InspectionCopy) {
  return tone === 'ok' ? copy.legendOk : tone === 'watch' ? copy.legendWatch : tone === 'fix' ? copy.legendFix : '';
}

/** UX-2-003: what a screen reader hears for a tire: position, PSI, tread and state. */
function tireAriaLabel(position: TirePosition, psi: number | null | undefined, tread: number | null | undefined, tone: Tone, copy: InspectionCopy) {
  const parts = [
    psi !== null && psi !== undefined ? `${psi} PSI` : null,
    tread !== null && tread !== undefined ? `${tread}/32` : null,
    tireStateLabel(tone, copy) || null,
  ].filter(Boolean);
  return parts.length ? `${position}: ${parts.join(', ')}` : position;
}

function toneOf(status: TireReadingStatus | null | undefined): Tone {
  if (!status) return 'empty';
  return status === TireReadingStatus.FIX ? 'fix' : status === TireReadingStatus.WATCH ? 'watch' : 'ok';
}

function formatWhen(iso: string, locale: InspectionLocale, withTime = true) {
  return new Date(iso).toLocaleString(locale === 'es' ? 'es-US' : 'en-US', withTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric' });
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.body && typeof error.body === 'object' && 'message' in error.body) {
    const message = (error.body as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

export function InspectionSheet(props: InspectionSheetProps) {
  const copy = inspectionCopy(props.locale);
  const { data, error, isLoading, mutate } = useTruckInspection(props.mode, props.truckId);
  const [adding, setAdding] = useState(false);

  if (isLoading && !data) return <PageSkeleton label={copy.loading} />;
  if (error instanceof ApiError && error.status === 403) return <Notice text={copy.notAllowed} />;
  if (error || !data) return <LoadFailure message={copy.loadFailed} retryLabel={copy.retry} onRetry={() => void mutate()} />;
  if (!data.inspection && !data.workOrder) return <Notice text={copy.needsWorkOrder} />;

  if (data.inspection && !adding) {
    return <InspectionReport state={data} inspection={data.inspection} copy={copy} locale={props.locale} doneHref={props.doneHref} onAdd={() => setAdding(true)} />;
  }
  // IN-8: inspected with the old buttons (before D41): say so above the sheet instead of an empty report.
  const legacy = data.legacyInspection;
  return (
    <>
    {legacy ? (
      <div className="mb-6">
        <NextStepCallout
          tone="muted"
          icon={Info}
          eyebrow={copy.reportTitle(data.truck.truckNumber)}
          title={copy.legacyTitle(legacy.outcome === 'issues_found')}
          sub={copy.legacySub(legacy.recordedAt ? formatWhen(legacy.recordedAt, props.locale) : '', legacy.byName ?? '')}
          testId="inspection-legacy"
        />
      </div>
    ) : null}
    <SheetFlow
      {...props}
      copy={copy}
      state={data}
      adding={adding && Boolean(data.inspection)}
      onCancelAdd={() => setAdding(false)}
      onDone={async (next, message) => {
        await mutate(next, { revalidate: false });
        setAdding(false);
        props.onSaved?.(message);
      }}
    />
    </>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-muted-foreground" role="status">
      <p className="flex items-start gap-2"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{text}</p>
    </div>
  );
}

// ───────────────────────── Sheet → Review ─────────────────────────

function SheetFlow({
  mode,
  truckId,
  locale,
  copy,
  state,
  adding,
  standardMechanics = [],
  barClassName,
  onCancelAdd,
  onDone,
}: Omit<InspectionSheetProps, 'onSaved'> & {
  copy: InspectionCopy;
  state: TruckInspectionStateDto;
  adding: boolean;
  onCancelAdd: () => void;
  onDone: (next: TruckInspectionStateDto, message: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const myName = user?.name ?? '';
  const saved = state.inspection;
  // Add defects works on the saved items (their ids), the first save on the checklist.
  const checklist: InspectionChecklistItemDto[] = useMemo(() => (adding && saved
    ? saved.items.map((item, index) => ({
        id: item.id,
        section: item.section,
        label: item.label,
        sortOrder: index,
        active: true,
        catalogJob: item.catalogJobId ? { id: item.catalogJobId, displayName: item.catalogJobName ?? '', categoryName: item.catalogCategoryName ?? '', active: true } : null,
        workflowStepKey: item.workflowStepKey,
      }))
    : state.checklist), [adding, saved, state.checklist]);
  const lockedDefects = useMemo(() => new Set(adding && saved ? saved.items.filter((item) => item.result === InspectionItemResult.DEFECT).map((item) => item.id) : []), [adding, saved]);
  const baseAnswers = useMemo<SheetDraft['answers']>(() => (adding && saved
    ? Object.fromEntries(saved.items.map((item) => [item.id, { result: item.result, note: item.note ?? '' }]))
    : {}), [adding, saved]);

  const [stored, store, clearStored] = useLocalDraft(adding ? null : inspectionDraftKey(truckId, state.workOrder?.id));
  // LTR-293 §2: Add defects keeps its own draft on this device too (it used to live only in memory).
  const [addStored, storeAdd, clearAddStored] = useLocalDraft(adding ? `${inspectionDraftKey(truckId, state.workOrder?.id)}:add` : null);
  const addDraft = useMemo<SheetDraft>(() => {
    const kept = addStored ? parseDraft(addStored) : null;
    return { ...EMPTY_DRAFT, ...kept, answers: { ...baseAnswers, ...kept?.answers } };
  }, [addStored, baseAnswers]);
  const draft = adding ? addDraft : parseDraft(stored);
  const setDraft = (next: SheetDraft) => (adding ? storeAdd(JSON.stringify(next)) : store(JSON.stringify(next)));

  const [view, setView] = useState<'sheet' | 'review'>('sheet');
  const [open, setOpen] = useState<Record<string, boolean>>({ interior: true, engine: true, exterior: true });
  const [tireView, setTireView] = useState<'diagram' | 'table'>('diagram');
  const [tireOpen, setTireOpen] = useState<TirePosition | null>(null);
  const [signed, setSigned] = useState(false);
  const [owners, setOwners] = useState<Record<string, string>>({});
  // D54: Flat Repair and Tires start on the Alignment team (its mechanic, or its queue); the Manager can change it.
  const tireJobIds = new Set([state.tireJobs?.flatRepair.id, state.tireJobs?.tires.id].filter((id): id is string => Boolean(id)));
  const goTo = state.tireJobsGoTo ?? null;
  const ownerOf = (catalogJobId: string) => owners[catalogJobId]
    ?? (tireJobIds.has(catalogJobId) && goTo ? goTo.mechanic?.id ?? ALIGNMENT_QUEUE : '');
  const assignable = goTo?.mechanic && !standardMechanics.some((mechanic) => mechanic.id === goTo.mechanic!.id)
    ? [...standardMechanics, goTo.mechanic]
    : standardMechanics;
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  const newIds = useMemo(() => new Set(adding ? checklist.filter((item) => draft.answers[item.id]?.result === InspectionItemResult.DEFECT && !lockedDefects.has(item.id)).map((item) => item.id) : []), [adding, checklist, draft, lockedDefects]);
  const progress = sheetProgress(checklist, adding ? { ...draft, tires: Object.fromEntries((saved?.tires ?? []).map((tire) => [tire.position, { psi: tire.psi, tread: tire.tread }])) } : draft);
  const preview = previewInspection({ ...state, checklist }, draft, adding ? newIds : undefined);
  const addMissingNotes = [...newIds].filter((id) => !draft.answers[id]?.note.trim()).length;
  const role = state.canAssign ? copy.roleManager : copy.roleMechanic;
  const truckNumber = state.truck.truckNumber;

  function setAnswer(id: string, result: InspectionItemResult) {
    const current = draft.answers[id];
    const answers = { ...draft.answers };
    if (adding) {
      if (result !== InspectionItemResult.DEFECT) return;
      if (current?.result === InspectionItemResult.DEFECT) answers[id] = baseAnswers[id];
      else answers[id] = { result, note: '' };
    } else if (current?.result === result) delete answers[id];
    else answers[id] = { result, note: current?.note ?? '' };
    idempotencyKey.current = null;
    setDraft({ ...draft, answers });
  }
  function setNote(id: string, note: string) {
    idempotencyKey.current = null;
    setDraft({ ...draft, answers: { ...draft.answers, [id]: { ...draft.answers[id], note } } });
  }
  function markRestOk(section: InspectionSection) {
    const answers = { ...draft.answers };
    for (const item of checklist) if (item.section === section && !answers[item.id]?.result) answers[item.id] = { result: InspectionItemResult.OK, note: '' };
    setDraft({ ...draft, answers });
  }
  function setTire(position: TirePosition, tire: TireAnswer) {
    idempotencyKey.current = null;
    setDraft({ ...draft, tires: { ...draft.tires, [position]: tire } });
  }

  async function submit() {
    setPending(true);
    setFailure(null);
    idempotencyKey.current ??= crypto.randomUUID();
    // Left as it came, a tire Job goes to Alignment on the server; "Assign later" on one is sent as null.
    const assignments = state.canAssign
      ? preview.newJobs.flatMap((job): Array<{ catalogJobId: string; assignedMechanicId: string | null }> => {
          const picked = owners[job.catalogJobId];
          if (picked === undefined || picked === ALIGNMENT_QUEUE) return [];
          if (!picked) return tireJobIds.has(job.catalogJobId) && goTo ? [{ catalogJobId: job.catalogJobId, assignedMechanicId: null }] : [];
          return [{ catalogJobId: job.catalogJobId, assignedMechanicId: picked }];
        })
      : undefined;
    try {
      if (adding) {
        const next = await addTruckInspectionDefects(mode, truckId, {
          idempotencyKey: idempotencyKey.current,
          defects: [...newIds].map((id) => ({ inspectionItemId: id, note: draft.answers[id].note.trim() })),
          ...(assignments?.length ? { assignments } : {}),
        });
        clearAddStored();
        await onDone(next, copy.defectsAdded(newIds.size, preview.newJobs.length));
      } else {
        const next = await saveTruckInspection(mode, truckId, {
          idempotencyKey: idempotencyKey.current,
          items: checklist.map((item) => ({ checklistItemId: item.id, result: draft.answers[item.id].result, ...(draft.answers[item.id].note.trim() ? { note: draft.answers[item.id].note.trim() } : {}) })),
          tires: TIRE_POSITIONS.map((position) => ({ position, psi: draft.tires[position]!.psi!, tread: draft.tires[position]!.tread! })),
          ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
          ...(assignments?.length ? { assignments } : {}),
        });
        clearStored();
        await onDone(next, !state.canAssign ? copy.savedForManager(preview.newJobs.length) : preview.issues ? copy.saved(preview.newJobs.length, state.workOrder?.displayId ?? '') : copy.savedNoIssues);
      }
      window.scrollTo(0, 0);
    } catch (error) {
      setFailure(errorMessage(error, copy.saveFailed));
    } finally {
      setPending(false);
    }
  }

  const header = adding
    ? (
      <>
        <section className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">{view === 'review' ? copy.reviewAdded(truckNumber) : copy.addDefectsTitle(truckNumber)}</h1>
            {newIds.size ? <Badge variant="destructive" dot>{copy.newDefects(newIds.size)}</Badge> : null}
          </div>
          {saved ? <p className="text-xs text-muted-foreground">{copy.inspectedBy(saved.inspectedBy.name, saved.inspectedBy.isMechanic ? copy.roleMechanic : copy.roleManager, formatWhen(saved.inspectedAt, locale))}</p> : null}
        </section>
        {view === 'sheet' ? <NextStepCallout tone="primary" icon={Info} eyebrow={copy.addDefects} title={copy.addOnlyTitle} sub={copy.addOnlySub} /> : null}
      </>
    )
    : (
      <section className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page-title">{view === 'review' ? copy.reviewTitle(truckNumber) : copy.title(truckNumber)}</h1>
          {view === 'sheet' && progress.defects ? <Badge variant="warning" dot>{copy.defectsSoFar(progress.defects)}</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground">{copy.meta(state.truck.mileage !== null ? `${state.truck.mileage.toLocaleString(locale === 'es' ? 'es-US' : 'en-US')} mi` : '—', myName, role)}</p>
        {view === 'sheet' ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:hidden">
            <span className="inline-flex items-center gap-1"><Check aria-hidden="true" className="size-3.5" />{copy.ok}</span>
            <span className="inline-flex items-center gap-1"><TriangleAlert aria-hidden="true" className="size-3.5" />{copy.defect}</span>
            <span className="inline-flex items-center gap-1"><Minus aria-hidden="true" className="size-3.5" />{copy.na}</span>
            <span>· {copy.tapAgainToClear}</span>
          </p>
        ) : null}
      </section>
    );

  if (view === 'review') {
    const created = preview.newJobs.length;
    const bar = (
      <FixedBar className={barClassName}>
        <span className="w-full text-xs text-muted-foreground sm:mr-auto sm:w-auto">
          {signed ? (state.canAssign ? copy.jobsGoTo(state.workOrder?.displayId ?? '') : copy.jobsGoToManager) : copy.signToSave}
        </span>
        <Button type="button" variant="outline" onClick={() => setView('sheet')} disabled={pending}><ArrowLeft aria-hidden="true" />{copy.back}</Button>
        <Button loading={pending} type="button" className="flex-1 sm:flex-none" disabled={!signed || pending} onClick={() => void submit()} data-testid="inspection-save">
          {created ? copy.saveCreate(created) : preview.issues ? copy.saveNotes : copy.saveNoIssues}
        </Button>
      </FixedBar>
    );
    return (
      <div className="space-y-6 pb-28">
        {header}
        {failure ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive-text">{failure}</p> : null}
        <ResultCallout copy={copy} issues={preview.issues} jobs={created + preview.addsToExisting.length} notes={preview.stepNotes.length} watch={preview.watch.length} sub={state.canAssign ? copy.issuesSubManager : copy.issuesSubMechanic} />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <SectionCard title={copy.jobsToCreate} count={preview.newJobs.length + preview.addsToExisting.length}>
              {preview.newJobs.length + preview.addsToExisting.length ? (
                <ul className="divide-y">
                  {[...preview.newJobs, ...preview.addsToExisting].map((job) => (
                    <PreviewJobRow
                      key={job.key}
                      job={job}
                      copy={copy}
                      canAssign={state.canAssign}
                      mechanics={assignable}
                      owner={ownerOf(job.catalogJobId)}
                      onOwner={(id) => setOwners({ ...owners, [job.catalogJobId]: id })}
                      alignment={tireJobIds.has(job.catalogJobId) ? goTo : null}
                    />
                  ))}
                </ul>
              ) : <p className="p-4 text-muted-foreground">—</p>}
            </SectionCard>
            {preview.stepNotes.length ? (
              <SectionCard title={copy.notesOnSteps}>
                <div className="space-y-1 px-4 py-3">
                  <div className="flex items-center gap-2"><span className="font-medium">Detailing</span><Badge variant="secondary">{copy.noNewJob}</Badge></div>
                  {preview.stepNotes.map((finding) => <p key={finding.label} className="text-muted-foreground"><span className="text-foreground">{finding.label}:</span> {finding.note}</p>)}
                </div>
              </SectionCard>
            ) : null}
            {preview.watch.length ? (
              <SectionCard title={copy.toWatch} count={preview.watch.length}>
                <ul className="divide-y">
                  {preview.watch.map((tire) => (
                    <li key={tire.position} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span><span className="font-medium">{tire.position}</span> <span className="text-muted-foreground">{tire.psi} PSI · {tire.tread}/32</span></span>
                      <Badge variant="warning" dot>{copy.legendWatch}</Badge>
                    </li>
                  ))}
                </ul>
                <p className="border-t bg-sunken px-4 py-2.5 text-xs text-muted-foreground">{copy.watchHint}</p>
              </SectionCard>
            ) : null}
            {draft.notes.trim() ? <SectionCard title={copy.sectionNotes}><p className="whitespace-pre-line p-4">{draft.notes}</p></SectionCard> : null}
          </div>
          <div className="space-y-6">
            {!adding ? (
              <SectionCard title={<><CircleDot aria-hidden="true" className="size-4" />{copy.sectionTires}</>}>
                <MiniTires copy={copy} statusOf={(position) => tireStatusOf(position, draft.tires[position], state.limits)?.status ?? null} psiOf={(position) => draft.tires[position]?.psi ?? null} />
              </SectionCard>
            ) : null}
            <SectionCard title={copy.signature}>
              <label className="flex min-h-12 items-start gap-3 p-4" data-testid="inspection-sign-label">
                <input type="checkbox" className="mt-0.5" checked={signed} onChange={(event) => setSigned(event.target.checked)} data-testid="inspection-sign" />
                <span>
                  <span className="font-medium">{adding ? copy.iFound(truckNumber) : copy.iInspected(truckNumber)}</span>
                  <span className="block text-xs text-muted-foreground">{copy.signedAs(myName, role)}</span>
                </span>
              </label>
            </SectionCard>
          </div>
        </div>
        {bar}
      </div>
    );
  }

  const canReview = adding ? newIds.size > 0 && addMissingNotes === 0 : progress.complete;
  const left = adding
    ? (!newIds.size ? copy.markNewDefect : addMissingNotes ? copy.defectsWithoutNote(addMissingNotes) : copy.newDefects(newIds.size))
    : progress.complete
      ? copy.allChecked
      : [
          progress.total - progress.answered ? copy.checksLeft(progress.total - progress.answered) : '',
          TIRE_POSITIONS.length - progress.tires ? copy.tiresLeft(TIRE_POSITIONS.length - progress.tires) : '',
          progress.missingNotes ? copy.defectsWithoutNote(progress.missingNotes) : '',
        ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-6 pb-28">
      {header}
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 xl:hidden" aria-label={copy.checklist}>
        {SECTIONS.map((section) => {
          const items = checklist.filter((item) => item.section === section.key);
          return (
            <a key={section.key} href={`#inspection-${section.key}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border bg-card px-3 font-medium">
              {section.label(copy)}<span className="tnum text-xs text-muted-foreground">{items.filter((item) => draft.answers[item.id]?.result).length}/{items.length}</span>
            </a>
          );
        })}
        {!adding ? <a href="#inspection-tires" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border bg-card px-3 font-medium">{copy.sectionTires}<span className="tnum text-xs text-muted-foreground">{progress.tires}/10</span></a> : null}
      </nav>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-6">
          {SECTIONS.map((section) => {
            const items = checklist.filter((item) => item.section === section.key);
            if (!items.length) return null;
            const done = items.filter((item) => draft.answers[item.id]?.result).length;
            const defects = items.filter((item) => draft.answers[item.id]?.result === InspectionItemResult.DEFECT).length;
            const isOpen = open[section.key] !== false;
            return (
              <div key={section.key} id={`inspection-${section.key}`} className="scroll-mt-20">
                <SectionCard
                  title={(
                    <>
                      <button type="button" className="-my-2 flex min-h-11 items-center gap-2" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [section.key]: !isOpen })}>
                        <ChevronDown aria-hidden="true" className={cn('size-3.5 text-muted-foreground transition', !isOpen && '-rotate-90')} />
                        {section.label(copy)}
                      </button>
                      <CountChip>{done}/{items.length}</CountChip>
                      {defects ? <Badge variant="destructive" dot>{copy.defectsCount(defects)}</Badge> : null}
                    </>
                  )}
                  action={adding ? null : done < items.length ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => markRestOk(section.key)}><CheckCheck aria-hidden="true" />{copy.markRestOk}</Button>
                  ) : <span className="inline-flex items-center gap-1 text-xs text-success"><CircleCheck aria-hidden="true" className="size-3.5" />{copy.sectionDone}</span>}
                >
                  {isOpen ? (
                    <ul className="divide-y">
                      {items.map((item) => (
                        <CheckRow
                          key={item.id}
                          item={item}
                          copy={copy}
                          answer={draft.answers[item.id]}
                          locked={lockedDefects.has(item.id)}
                          addOnly={adding}
                          onAnswer={(result) => setAnswer(item.id, result)}
                          onNote={(note) => setNote(item.id, note)}
                        />
                      ))}
                    </ul>
                  ) : null}
                </SectionCard>
              </div>
            );
          })}
        </div>
        <div className="space-y-6 xl:sticky xl:top-20">
          {adding && saved ? (
            <SectionCard title={<><CircleDot aria-hidden="true" className="size-4" />{copy.sectionTires}</>}>
              <MiniTires copy={copy} statusOf={(position) => saved.tires.find((tire) => tire.position === position)?.status ?? null} psiOf={(position) => saved.tires.find((tire) => tire.position === position)?.psi ?? null} />
              <p className="border-t bg-sunken px-4 py-2.5 text-xs text-muted-foreground">{copy.tiresAsRecorded(formatWhen(saved.inspectedAt, locale))}</p>
            </SectionCard>
          ) : (
            <>
              <TiresCard copy={copy} state={state} draft={draft} view={tireView} onView={setTireView} onOpenTire={setTireOpen} onTire={setTire} />
              <SectionCard title={copy.sectionNotes}>
                <div className="space-y-1.5 p-4">
                  <Textarea value={draft.notes} placeholder={copy.notesPlaceholder} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} aria-label={copy.sectionNotes} />
                  <p className="text-xs text-muted-foreground">{copy.notesHint}</p>
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>
      {tireOpen ? (
        <TireDialog
          copy={copy}
          locale={locale}
          position={tireOpen}
          state={state}
          value={draft.tires[tireOpen]}
          onClose={() => setTireOpen(null)}
          onSave={(tire, move) => {
            setTire(tireOpen, tire);
            const index = TIRE_POSITIONS.indexOf(tireOpen) + move;
            setTireOpen(move === 0 || index < 0 || index >= TIRE_POSITIONS.length ? null : TIRE_POSITIONS[index]);
          }}
        />
      ) : null}
      <FixedBar className={barClassName}>
        <div className="min-w-0 flex-1">
          <p className="tnum truncate font-medium">{left}</p>
          {!adding ? (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', progress.complete ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.round(((progress.answered + progress.tires) / (progress.total + TIRE_POSITIONS.length)) * 100)}%` }} />
            </div>
          ) : null}
        </div>
        {adding ? <Button type="button" variant="ghost" onClick={onCancelAdd}>{copy.cancel}</Button> : null}
        <Button type="button" disabled={!canReview} onClick={() => { setView('review'); window.scrollTo(0, 0); }} data-testid="inspection-review">
          {copy.review}<ArrowRight aria-hidden="true" />
        </Button>
      </FixedBar>
    </div>
  );
}

function FixedBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    // LTR-234: hidden while the keyboard is open, so it never sits over a field.
    <div data-hide-on-keyboard="" className={cn('fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur', className)}>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-end gap-2 px-4 py-3 md:px-6">{children}</div>
    </div>
  );
}

function CheckRow({
  item,
  copy,
  answer,
  locked,
  addOnly,
  onAnswer,
  onNote,
}: {
  item: InspectionChecklistItemDto;
  copy: InspectionCopy;
  answer: { result: InspectionItemResult; note: string } | undefined;
  locked: boolean;
  addOnly: boolean;
  onAnswer: (result: InspectionItemResult) => void;
  onNote: (note: string) => void;
}) {
  if (locked) {
    return (
      <li className="bg-sunken/60">
        <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
          <div className="min-w-0 flex-1"><p>{item.label}</p><p className="text-xs text-muted-foreground">{answer?.note}</p></div>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Lock aria-hidden="true" className="size-3.5" />{copy.savedDefect}</span>
        </div>
      </li>
    );
  }
  const options: Array<{ value: InspectionItemResult; label: string; Icon: typeof Check; on: string }> = [
    { value: InspectionItemResult.OK, label: copy.ok, Icon: Check, on: 'bg-success/15 text-success ring-1 ring-success/40' },
    { value: InspectionItemResult.DEFECT, label: copy.defect, Icon: TriangleAlert, on: 'bg-destructive/20 text-destructive-text ring-1 ring-destructive/50' },
    { value: InspectionItemResult.NA, label: copy.na, Icon: Minus, on: 'bg-muted text-foreground ring-1 ring-border' },
  ];
  const isDefect = answer?.result === InspectionItemResult.DEFECT;
  return (
    <li data-testid="inspection-check" data-check={item.label}>
      <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-1.5">
        <span className={cn('min-w-0 flex-1', answer?.result === InspectionItemResult.NA && 'text-muted-foreground line-through decoration-1')}>{item.label}</span>
        <div className="flex shrink-0 gap-1 rounded-lg bg-sunken p-1 ring-1 ring-border" role="group" aria-label={item.label}>
          {options.map(({ value, label, Icon, on }) => {
            const selected = answer?.result === value;
            const disabled = addOnly && value !== InspectionItemResult.DEFECT;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                aria-label={label}
                disabled={disabled}
                onClick={() => onAnswer(value)}
                className={cn(
                  'inline-flex min-h-9 min-w-10 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium sm:px-2.5',
                  selected ? on : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  disabled && !selected && 'opacity-40 hover:bg-transparent',
                )}
              >
                <Icon aria-hidden="true" className="size-3.5" /><span className={selected ? '' : 'hidden sm:inline'}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {isDefect ? (
        <div className="space-y-2 border-t border-destructive/20 bg-destructive/[0.04] px-4 py-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{copy.whatsWrong} <span className="text-destructive-text">*</span></span>
            <Textarea value={answer?.note ?? ''} placeholder={copy.whatsWrongPlaceholder} onChange={(event) => onNote(event.target.value)} className="min-h-20" />
          </label>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            {item.workflowStepKey ? <MessageSquare aria-hidden="true" className="mt-px size-3.5" /> : <Wrench aria-hidden="true" className="mt-px size-3.5" />}
            <span>{item.workflowStepKey ? copy.goesToDetailing : item.catalogJob ? copy.createsJob(item.catalogJob.displayName, item.catalogJob.categoryName) : ''}</span>
          </p>
        </div>
      ) : null}
    </li>
  );
}

// ───────────────────────── Tires ─────────────────────────

function axleLabel(key: 'steer' | 'd1' | 'd2', copy: InspectionCopy) {
  return key === 'steer' ? copy.steer : key === 'd1' ? copy.drive1 : copy.drive2;
}

function TiresCard({
  copy,
  state,
  draft,
  view,
  onView,
  onOpenTire,
  onTire,
}: {
  copy: InspectionCopy;
  state: TruckInspectionStateDto;
  draft: SheetDraft;
  view: 'diagram' | 'table';
  onView: (view: 'diagram' | 'table') => void;
  onOpenTire: (position: TirePosition) => void;
  onTire: (position: TirePosition, tire: TireAnswer) => void;
}) {
  const limits = state.limits;
  const statusOf = (position: TirePosition) => tireStatusOf(position, draft.tires[position], limits)?.status ?? null;
  const done = TIRE_POSITIONS.filter((position) => statusOf(position)).length;
  const toFix = TIRE_POSITIONS.filter((position) => statusOf(position) === TireReadingStatus.FIX).length;
  const previous = new Map(state.previousTires.map((tire) => [tire.position, tire]));
  const toggle = (
    <div className="hidden grid-cols-2 gap-1 rounded-lg bg-sunken p-1 ring-1 ring-border sm:grid">
      {(['diagram', 'table'] as const).map((value) => (
        <button key={value} type="button" aria-pressed={view === value} onClick={() => onView(value)} className={cn('inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium', view === value ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground')}>
          {value === 'diagram' ? <LayoutGrid aria-hidden="true" className="size-3.5" /> : <List aria-hidden="true" className="size-3.5" />}
          {value === 'diagram' ? copy.tiresDiagram : copy.tiresTable}
        </button>
      ))}
    </div>
  );
  return (
    <div id="inspection-tires" className="scroll-mt-20">
      <SectionCard
        title={<><CircleDot aria-hidden="true" className="size-4" />{copy.sectionTires}<CountChip>{done}/10</CountChip>{toFix ? <Badge variant="destructive" dot>{toFix}</Badge> : null}</>}
        action={toggle}
      >
        {view === 'diagram' ? (
          <div className="px-4 pb-3 pt-4">
            <div className="mx-auto max-w-[330px]">
              <div className="mx-auto mb-2 flex h-10 w-[46%] items-center justify-center gap-1 rounded-b-md rounded-t-[18px] border bg-sunken text-xs text-muted-foreground">
                <ArrowUp aria-hidden="true" className="size-3.5" />{copy.front}
              </div>
              {AXLES.map((axle, index) => (
                <div key={axle.key} className={cn(index === 1 && 'mt-6', index === 2 && 'mt-3')}>
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex gap-1.5">{axle.left.map((position) => <TireButton key={position} copy={copy} position={position} tire={draft.tires[position]} tone={toneOf(statusOf(position))} onClick={() => onOpenTire(position)} />)}</div>
                    <div className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs text-muted-foreground">{axleLabel(axle.key, copy)}</span>
                      <div aria-hidden="true" className="h-0.5 w-full bg-[repeating-linear-gradient(90deg,var(--border)_0_6px,transparent_6px_10px)]" />
                      <span className="tnum text-xs text-muted-foreground">{axle.key === 'steer' ? limits.steerTargetPsi : limits.driveTargetPsi} PSI</span>
                    </div>
                    <div className="flex gap-1.5">{axle.right.map((position) => <TireButton key={position} copy={copy} position={position} tire={draft.tires[position]} tone={toneOf(statusOf(position))} onClick={() => onOpenTire(position)} />)}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">{copy.tapTire}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-xs text-muted-foreground">
                <tr><th className="px-4 py-2 text-left font-medium">{copy.tireColumn}</th><th className="px-2 py-2 text-left font-medium">PSI</th><th className="px-2 py-2 text-left font-medium">Tread /32</th><th className="px-4 py-2 text-right font-medium">{copy.lastColumn}</th></tr>
              </thead>
              <tbody className="divide-y">
                {TIRE_POSITIONS.map((position) => {
                  const tire = draft.tires[position];
                  const last = previous.get(position);
                  const number = (value: string) => (value === '' ? null : Math.max(0, Math.round(Number(value))));
                  return (
                    <tr key={position}>
                      <td className="px-4 py-1.5"><span className="inline-flex items-center gap-2"><span aria-hidden="true" className={cn('size-2 rounded-full', DOT[toneOf(statusOf(position))])} /><span className="font-medium">{position}</span>{toneOf(statusOf(position)) !== 'empty' ? <span className="sr-only">{tireStateLabel(toneOf(statusOf(position)), copy)}</span> : null}</span></td>
                      <td className="px-2 py-1.5"><input type="number" inputMode="numeric" aria-label={`${position} PSI`} className="field tnum !min-h-9 w-20 !py-1.5" value={tire?.psi ?? ''} placeholder={String(tireTargets(position, limits).targetPsi)} onChange={(event) => onTire(position, { psi: number(event.target.value), tread: tire?.tread ?? null })} /></td>
                      <td className="px-2 py-1.5"><input type="number" inputMode="numeric" aria-label={`${position} tread`} className="field tnum !min-h-9 w-16 !py-1.5" value={tire?.tread ?? ''} onChange={(event) => onTire(position, { psi: tire?.psi ?? null, tread: number(event.target.value) })} /></td>
                      <td className="tnum px-4 py-1.5 text-right text-xs text-muted-foreground">{last ? `${last.psi} · ${last.tread}/32` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-3 text-xs text-muted-foreground">
          {(['ok', 'watch', 'fix'] as const).map((tone) => {
            const Icon = TIRE_ICON[tone]!;
            return <span key={tone} className="inline-flex items-center gap-1"><span aria-hidden="true" className={cn('size-2 rounded-full', DOT[tone])} /><Icon aria-hidden="true" className={cn('size-3', TIRE_TEXT[tone])} />{tireStateLabel(tone, copy)}</span>;
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-sunken px-4 py-2.5 text-xs text-muted-foreground">
          <span>{copy.targets(limits.steerTargetPsi, limits.driveTargetPsi)}</span>
          <span>{copy.minTread(limits.steerMinTread, limits.driveMinTread)}</span>
        </div>
      </SectionCard>
    </div>
  );
}

function TireButton({ copy, position, tire, tone, onClick }: { copy: InspectionCopy; position: TirePosition; tire: TireAnswer | undefined; tone: Tone; onClick: () => void }) {
  const Icon = TIRE_ICON[tone];
  return (
    <button type="button" onClick={onClick} data-testid={`tire-${position}`} className={cn('relative flex h-[78px] w-[60px] flex-col items-center justify-center rounded-lg border-2 hover:ring-2 hover:ring-ring/40 sm:w-16', TIRE_TONE[tone])} aria-label={tireAriaLabel(position, tire?.psi, tire?.tread, tone, copy)}>
      {Icon ? <Icon aria-hidden="true" className={cn('absolute right-1 top-1 size-3', TIRE_TEXT[tone])} /> : null}
      <span className="text-xs font-semibold text-muted-foreground">{position}</span>
      <span className={cn('tnum text-base font-semibold leading-tight', TIRE_TEXT[tone])}>{tire?.psi ?? '—'}</span>
      <span className="tnum text-xs text-muted-foreground">{tire?.tread !== null && tire?.tread !== undefined ? `${tire.tread}/32` : 'PSI'}</span>
    </button>
  );
}

/**
 * D41: one tire's PSI and tread. LTR-234: the sheet stays open from one tire to the next (only its body changes), so
 * the phone keyboard does not close and reopen; on phones it is compact so both fields and Next fit above it.
 */
function TireDialog({
  copy,
  locale,
  position,
  state,
  value,
  onClose,
  onSave,
}: {
  copy: InspectionCopy;
  locale: InspectionLocale;
  position: TirePosition;
  state: TruckInspectionStateDto;
  value: TireAnswer | undefined;
  onClose: () => void;
  onSave: (tire: TireAnswer, move: -1 | 0 | 1) => void;
}) {
  const index = TIRE_POSITIONS.indexOf(position);
  const last = state.previousTires.find((tire) => tire.position === position);
  return (
    <Modal
      open
      title={`${position} · ${axleLabel(tireAxle(position) === 'steer' ? 'steer' : index < 6 ? 'd1' : 'd2', copy)}`}
      description={<>{copy.tireOf(index + 1)} · {last ? copy.lastCheck(formatWhen(last.readAt, locale, false), last.psi, last.tread) : copy.noPreviousReading}</>}
      onClose={onClose}
      closeLabel={copy.close}
    >
      <TireForm key={position} copy={copy} position={position} state={state} value={value} onSave={onSave} />
    </Modal>
  );
}

function TireForm({
  copy,
  position,
  state,
  value,
  onSave,
}: {
  copy: InspectionCopy;
  position: TirePosition;
  state: TruckInspectionStateDto;
  value: TireAnswer | undefined;
  onSave: (tire: TireAnswer, move: -1 | 0 | 1) => void;
}) {
  const target = tireTargets(position, state.limits);
  const [psi, setPsi] = useState(value?.psi !== null && value?.psi !== undefined ? String(value.psi) : '');
  const [tread, setTread] = useState(value?.tread !== null && value?.tread !== undefined ? String(value.tread) : '');
  const treadRef = useRef<HTMLInputElement>(null);
  const index = TIRE_POSITIONS.indexOf(position);
  const hasNext = index < TIRE_POSITIONS.length - 1;
  const parsed: TireAnswer = { psi: psi === '' ? null : Math.max(0, Math.round(Number(psi))), tread: tread === '' ? null : Math.max(0, Math.round(Number(tread))) };
  const status = tireStatusOf(position, parsed, state.limits)?.status ?? null;
  const step = (field: 'psi' | 'tread', delta: number) => {
    const current = field === 'psi' ? psi : tread;
    const base = current === '' ? (field === 'psi' ? target.targetPsi : 8) : Number(current);
    const next = String(Math.max(0, base + delta));
    if (field === 'psi') setPsi(next); else setTread(next);
  };
  const stepper = (field: 'psi' | 'tread', label: string, unit: string, current: string, set: (value: string) => void) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-stretch gap-1.5">
        <Button type="button" variant="outline" size="icon" className="size-12 [@media(pointer:fine)]:size-12" aria-label={copy.less} onClick={() => step(field, -1)}><Minus aria-hidden="true" /></Button>
        <div className="relative flex-1">
          <input
            ref={field === 'tread' ? treadRef : undefined}
            type="number"
            inputMode="numeric"
            autoFocus={field === 'psi'}
            enterKeyHint={field === 'psi' || hasNext ? 'next' : 'done'}
            aria-label={`${position} ${field === 'psi' ? 'PSI' : 'tread'}`}
            className="field tnum !min-h-12 text-center !text-xl font-semibold"
            value={current}
            onChange={(event) => set(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              // PSI → tread → next tire, like the paper sheet.
              if (field === 'psi') treadRef.current?.focus();
              else onSave(parsed, hasNext ? 1 : 0);
            }}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
        </div>
        <Button type="button" variant="outline" size="icon" className="size-12 [@media(pointer:fine)]:size-12" aria-label={copy.more} onClick={() => step(field, 1)}><Plus aria-hidden="true" /></Button>
      </div>
    </label>
  );
  return (
    <>
      <div className="space-y-3 sm:space-y-4">
        {stepper('psi', copy.pressureTarget(target.targetPsi), 'PSI', psi, setPsi)}
        {stepper('tread', copy.treadMin(target.minTread), '/32', tread, setTread)}
        <div className="min-h-6">
          {status ? (
            <Badge variant={status === TireReadingStatus.FIX ? 'destructive' : status === TireReadingStatus.WATCH ? 'warning' : 'success'} dot>
              {status === TireReadingStatus.FIX ? copy.statusFix : status === TireReadingStatus.WATCH ? copy.statusWatch : copy.statusOk}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2 sm:mt-5">
        {index > 0 ? <Button type="button" variant="outline" aria-label={copy.previousTire} onClick={() => onSave(parsed, -1)}><ArrowLeft aria-hidden="true" /></Button> : null}
        <Button type="button" variant="outline" className="flex-1" onClick={() => onSave(parsed, 0)}>{copy.done}</Button>
        {hasNext ? <Button type="button" className="flex-1" onClick={() => onSave(parsed, 1)}>{copy.nextTire}<ArrowRight aria-hidden="true" /></Button> : null}
      </div>
    </>
  );
}

export function MiniTires({
  copy,
  statusOf,
  psiOf,
}: {
  copy: InspectionCopy;
  statusOf: (position: TirePosition) => TireReadingStatus | null;
  psiOf: (position: TirePosition) => number | null;
}) {
  const tile = (position: TirePosition) => {
    const tone = toneOf(statusOf(position));
    const Icon = TIRE_ICON[tone];
    const label = tireAriaLabel(position, psiOf(position), null, tone, copy);
    // UX-2-003: icon next to the PSI and the full state in the name, not only the color.
    return (
      <span key={position} role="img" aria-label={label} title={label} className={cn('tnum flex h-9 w-10 items-center justify-center gap-0.5 rounded-md border text-xs font-medium', TIRE_TONE[tone], TIRE_TEXT[tone])}>
        {psiOf(position) ?? '—'}
        {Icon ? <Icon aria-hidden="true" className="size-2.5 shrink-0" /> : null}
      </span>
    );
  };
  return (
    <div className="space-y-2 p-4">
      {AXLES.map((axle) => (
        <div key={axle.key} className="flex items-center justify-between gap-2">
          <div className="flex gap-1">{axle.left.map(tile)}</div>
          <span className="text-xs text-muted-foreground">{axleLabel(axle.key, copy)}</span>
          <div className="flex gap-1">{axle.right.map(tile)}</div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Review bits and the saved report ─────────────────────────

function ResultCallout({ copy, issues, jobs, notes, watch, sub }: { copy: InspectionCopy; issues: boolean; jobs: number; notes: number; watch: number; sub: string }) {
  return issues
    ? <NextStepCallout tone="warning" icon={TriangleAlert} eyebrow={copy.result} title={copy.issuesFound(jobs, notes)} sub={sub} />
    : <NextStepCallout tone="success" icon={CircleCheck} eyebrow={copy.result} title={copy.noIssuesFound} sub={copy.noIssuesSub(watch)} />;
}

/** D54: the select value for "leave it in the Alignment queue" (never sent to the server). */
const ALIGNMENT_QUEUE = '__alignment_queue';

function PreviewJobRow({
  job,
  copy,
  canAssign,
  mechanics,
  owner,
  onOwner,
  alignment,
}: {
  job: PreviewJob;
  copy: InspectionCopy;
  canAssign: boolean;
  mechanics: ReadonlyArray<{ id: string; name: string }>;
  owner: string;
  onOwner: (id: string) => void;
  /** D54: set for Flat Repair and Tires, which go to the Alignment team. */
  alignment?: TruckInspectionStateDto['tireJobsGoTo'];
}) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4" data-testid="inspection-preview-job">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{job.displayName}</span>
          <span className="text-xs text-muted-foreground">{job.categoryName}</span>
          {job.findings.length > 1 ? <Badge variant="secondary">{copy.defectsInOneJob(job.findings.length)}</Badge> : null}
          {!job.existing ? <Badge variant="default">{copy.newJob}</Badge> : null}
        </div>
        <ul className="space-y-0.5 text-muted-foreground">
          {job.findings.map((finding) => <li key={finding.label}><span className="text-foreground">{finding.label}:</span> {finding.note}</li>)}
        </ul>
      </div>
      <div className="shrink-0">
        {job.existing ? <Badge variant="secondary">{copy.addsToExisting(job.displayName)}</Badge>
          : canAssign ? (
            <select className="field !min-h-9 w-full !py-1.5 text-base sm:w-44 sm:text-sm" value={owner} onChange={(event) => onOwner(event.target.value)} aria-label={job.displayName}>
              <option value="">{copy.assignLater}</option>
              {alignment?.queue ? <option value={ALIGNMENT_QUEUE}>{copy.alignmentQueue}</option> : null}
              {mechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>)}
            </select>
          ) : alignment ? <span className="text-xs text-muted-foreground" data-testid="inspection-goes-to-alignment">{copy.goesToAlignment(alignment.mechanic?.name ?? null)}</span>
            : <span className="text-xs text-muted-foreground">{copy.managerAssigns}</span>}
      </div>
    </li>
  );
}

function InspectionReport({
  state,
  inspection,
  copy,
  locale,
  doneHref,
  onAdd,
}: {
  state: TruckInspectionStateDto;
  inspection: TruckInspectionDto;
  copy: InspectionCopy;
  locale: InspectionLocale;
  doneHref: string;
  onAdd: () => void;
}) {
  const when = formatWhen(inspection.inspectedAt, locale);
  const role = inspection.inspectedBy.isMechanic ? copy.roleMechanic : copy.roleManager;
  const detailing = inspection.jobs.filter((job) => job.displayName.toLowerCase().includes('detailing'));
  const jobs = inspection.jobs.filter((job) => !detailing.includes(job));
  const watch = inspection.tires.filter((tire) => tire.status === TireReadingStatus.WATCH);
  const canAdd = state.canInspect && inspection.workOrderOpen;
  const count = (section: InspectionSection, result: InspectionItemResult) => inspection.items.filter((item) => item.section === section && item.result === result).length;
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="page-title">{copy.reportTitle(state.truck.truckNumber)}</h1>
          <p className="text-xs text-muted-foreground">{copy.inspectedBy(inspection.inspectedBy.name, role, when)} · {copy.checksAndTires(inspection.items.length)}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href={doneHref}><ArrowLeft aria-hidden="true" />{copy.back}</Link></Button>
          {canAdd ? <Button type="button" onClick={onAdd} data-testid="inspection-add-defects"><Plus aria-hidden="true" />{copy.addDefects}</Button> : null}
        </div>
      </section>
      <ResultCallout copy={copy} issues={inspection.issuesFound} jobs={jobs.length} notes={detailing.length} watch={watch.length} sub={copy.issuesSubSaved} />
      <p className="flex items-start gap-2 text-xs text-muted-foreground"><Lock aria-hidden="true" className="mt-px size-3.5" />{copy.readOnlyHint}</p>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <SectionCard title={copy.jobsCreated} count={jobs.length}>
            {jobs.length ? (
              <ul className="divide-y">
                {jobs.map((job) => (
                  <li key={job.jobId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{job.displayName}</span>
                        {job.sources.length > 1 ? <Badge variant="secondary">{copy.defectsInOneJob(job.sources.length)}</Badge> : null}
                      </div>
                      <ul className="space-y-1 text-muted-foreground">
                        {job.sources.map((source, index) => (
                          <li key={`${source.label}-${index}`}>
                            {source.note}
                            {source.addedLater ? <Badge variant="default" className="ml-2">{copy.addedLater(laterBy(inspection, source.label) ?? '', laterAt(inspection, source.label, locale) ?? '')}</Badge> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{job.assignedMechanicName ?? copy.unassigned}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="p-4 text-muted-foreground">—</p>}
          </SectionCard>
          {detailing.length ? (
            <SectionCard title={copy.notesOnSteps}>
              {detailing.map((job) => (
                <div key={job.jobId} className="space-y-1 px-4 py-3">
                  <div className="flex items-center gap-2"><span className="font-medium">{job.displayName}</span><Badge variant="secondary">{copy.noNewJob}</Badge></div>
                  {job.sources.map((source, index) => <p key={index} className="text-muted-foreground">{source.note}</p>)}
                </div>
              ))}
            </SectionCard>
          ) : null}
          {watch.length ? (
            <SectionCard title={copy.toWatch} count={watch.length}>
              <ul className="divide-y">
                {watch.map((tire) => (
                  <li key={tire.position} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span><span className="font-medium">{tire.position}</span> <span className="text-muted-foreground">{tire.psi} PSI · {tire.tread}/32</span></span>
                    <Badge variant="warning" dot>{copy.legendWatch}</Badge>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
          {inspection.notes ? <SectionCard title={copy.sectionNotes}><p className="whitespace-pre-line p-4">{inspection.notes}</p></SectionCard> : null}
        </div>
        <div className="space-y-6">
          <SectionCard title={<><CircleDot aria-hidden="true" className="size-4" />{copy.sectionTires}</>} action={<CountChip>{copy.tiresOk(inspection.tires.filter((tire) => tire.status === TireReadingStatus.OK).length)}</CountChip>}>
            <MiniTires copy={copy} statusOf={(position) => inspection.tires.find((tire) => tire.position === position)?.status ?? null} psiOf={(position) => inspection.tires.find((tire) => tire.position === position)?.psi ?? null} />
          </SectionCard>
          <SectionCard title={copy.checklist}>
            <ul className="divide-y">
              {SECTIONS.map((section) => (
                <li key={section.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>{section.label(copy)}</span>
                  <span className="tnum text-muted-foreground">{copy.checklistLine(count(section.key, InspectionItemResult.OK), count(section.key, InspectionItemResult.NA), count(section.key, InspectionItemResult.DEFECT))}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title={copy.signature}>
            <p className="flex items-center gap-2 p-4"><PenLine aria-hidden="true" className="size-4 text-muted-foreground" />{copy.signedBy(`${inspection.inspectedBy.name} (${role})`, when)}</p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function laterBy(inspection: TruckInspectionDto, label: string) {
  return inspection.items.find((item) => item.label === label)?.addedLater?.byName ?? null;
}

function laterAt(inspection: TruckInspectionDto, label: string, locale: InspectionLocale) {
  const at = inspection.items.find((item) => item.label === label)?.addedLater?.at;
  return at ? formatWhen(at, locale) : null;
}
