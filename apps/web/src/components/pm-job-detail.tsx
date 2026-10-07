'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { BlockerReason, MECHANIC_BLOCKER_REASONS, MechanicMode, PauseReason, type WorkOrderDetailDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { formatMileage, pauseLabel } from '@/lib/format';
import { useShopLocale } from '@/lib/locale-context';
import { clockStoppedLine } from '@/lib/clock-stopped';
import { shopKeys, useCatalogJobs, useWorkOrders } from '@/lib/shop-data';
import { vehicleLine } from '@/lib/work-order-identity';
import { intlLocale } from '@/lib/shop-locale';
import { useActionToast } from './action-toast';
import { PmInProgressNotice } from './pm-in-progress-notice';
import { PmServiceCard, type PmDraftState } from './pm-service-card';
import { TruckInformationFields } from './truck-information-fields';
import { WorkOrderNotesThread } from './work-order-notes-thread';
import { Button, DialogActions, InlineAlert, Label, Modal, PageHeader, Textarea, WorkspaceNav } from './ui';
import { ResponsiveMenu } from './responsive-menu';
import { CheckCheck, ChevronDown, CircleAlert } from 'lucide-react';

/**
 * LTR-146: the PM mechanic's view of a truck Work Order — only its PM job.
 * Start the PM service, record mileage + parts, and finish the PM job. The
 * Work Order itself stays with the Standard team and the Shop Manager.
 */
export function PmJobDetail({
  wo,
  onUpdated,
}: {
  wo: WorkOrderDetailDto;
  onUpdated: (updated: WorkOrderDetailDto) => Promise<void>;
}) {
  const { messages } = useShopLocale();
  const { showToast } = useActionToast();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  // LTR-158 / D17: the PM mechanic blocks their PM job and adds notes; the Manager resolves.
  const [blockerOpen, setBlockerOpen] = useState(false);
  const [blockerReason, setBlockerReason] = useState<BlockerReason | ''>('');
  const [blockerNotes, setBlockerNotes] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  // Stage PM-2 (D-PM5): after PM A ↔ PM B, "Changed to PM B Service · Undo" for a few seconds.
  const [serviceChange, setServiceChange] = useState<{ fromId: string; toName: string } | null>(null);
  useEffect(() => {
    if (!serviceChange) return;
    const timer = window.setTimeout(() => setServiceChange(null), 8000);
    return () => window.clearTimeout(timer);
  }, [serviceChange]);
  const [blockerNotesError, setBlockerNotesError] = useState(false);
  const [draft, setDraft] = useState<PmDraftState>({
    ready: false, pending: false, hasError: false, observedMileage: '', selectedParts: 0,
  });
  const pmJob = wo.pmJob;
  const pmJobRow = wo.jobs.find((job) => job.id === pmJob?.id);
  const { data: pmServices } = useCatalogJobs(pmJobRow?.category.id ?? '', Boolean(pmJobRow) && pmJob?.status === 'to_do');
  const pmServiceOptions = (pmServices ?? []).filter((item) => /^PM [A-Z] Service$/i.test(item.displayName) || item.id === pmJobRow?.catalogJobId);
  // Block A (PM5): one running PM at a time — another truck's PM in progress is shown before Start, not after.
  const { data: pmLists } = useWorkOrders(Boolean(pmJob) && !pmJob?.startedAt, MechanicMode.PM);
  const otherRunningPm = pmLists?.active.find((item) => item.id !== wo.id) ?? null;
  if (!pmJob) return null;

  const started = Boolean(pmJob.startedAt);
  const activeBlocker = (wo.activeBlockers ?? []).find((blocker) => blocker.job?.id === pmJob.id) ?? null;
  const finished = pmJob.status === 'completed';
  const mileage = Number(draft.observedMileage);
  const validMileage = draft.observedMileage.trim() !== '' && Number.isInteger(mileage) && mileage >= 0;
  const finishBlocked = busy || Boolean(activeBlocker) || !draft.ready || draft.pending || draft.hasError || !validMileage || draft.selectedParts < 1;
  const mileageChangesTruck = validMileage && mileage !== wo.truck.mileage;
  // Stage PM-2 (UX-7-006): one exact reason when Finish cannot be used yet.
  const finishReason = activeBlocker ? messages.finishBlocked
    : draft.blockReason === 'enter' || (!validMileage && draft.ready) ? messages.finishEnterMileage
    : draft.blockReason === 'below' ? messages.finishCheckMileage
    : draft.blockReason === 'confirm' ? messages.finishConfirmMileage
    : draft.blockReason === 'choose' && draft.chooseCategory ? messages.finishChoosePart(draft.chooseCategory)
    : draft.blockReason === 'offline' ? messages.finishWaitingSave
    : draft.pending ? messages.saving
    : draft.selectedParts < 1 ? messages.finishAddPart
    : messages.finishReady(formatMileage(mileage), draft.selectedParts);
  // LTR-186 / D20, D21: the PM was started but my clock stopped (day close, another Truck, a resolved
  // blocker). Continue reopens my clock; the PM service itself is unchanged.
  const needsContinue = started && !finished && !activeBlocker && wo.status === 'in_progress' && wo.laborRunning === false;
  const stoppedLine = clockStoppedLine(wo.myClockStopped, messages);

  async function run(action: () => Promise<WorkOrderDetailDto>, onSuccess?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      await onUpdated(updated);
      void mutate(shopKeys.pmService(wo.id));
      onSuccess?.();
    } catch (err) {
      setError(apiErrorMessage(err, messages, messages.actionFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <WorkspaceNav mode={MechanicMode.PM} />
      <PageHeader
        className="mb-6"
        title={messages.truckTitle(wo.truckNumber)}
        subtitle={[vehicleLine(wo.truck), messages.pmJobOnWorkOrder(pmJob.displayName, wo.displayId)].filter(Boolean).join(' · ')}
        backHref="/mechanic/pm"
      />
      {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

      {/* LTR-148 / Stage PM-2: PM A ↔ PM B as a chip under the title; the change can be undone (D-PM5). */}
      {!finished && pmJobRow && pmServiceOptions.length > 1 ? (
        <div className="-mt-3 mb-4 flex flex-wrap items-center gap-2">
          <ResponsiveMenu
            label={messages.pmServiceTypeLabel}
            trigger={(
              <Button variant="outline" size="sm" className="rounded-full" disabled={busy} data-testid="pm-service-type" aria-label={`${messages.pmServiceTypeLabel}: ${pmJobRow.displayName}`}>
                {pmJobRow.displayName.replace(/ Service$/i, '')}<ChevronDown aria-hidden="true" />
              </Button>
            )}
            items={pmServiceOptions.filter((item) => item.id !== pmJobRow.catalogJobId).map((item) => ({
              key: item.id,
              label: item.displayName,
              onSelect: () => {
                const fromId = pmJobRow.catalogJobId ?? '';
                void run(
                  () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/jobs/${pmJob.id}/pm-service`, {
                    method: 'POST',
                    body: JSON.stringify({ catalogJobId: item.id }),
                  }),
                  () => setServiceChange(fromId ? { fromId, toName: item.displayName } : null),
                );
              },
            }))}
          />
          <span className="text-xs text-muted-foreground">{messages.serviceTypeHint}</span>
          {serviceChange ? (
            <p className="flex w-full items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm" role="status" data-testid="pm-service-changed">
              {messages.serviceChanged(serviceChange.toName)}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto underline"
                disabled={busy}
                onClick={() => {
                  const back = serviceChange.fromId;
                  setServiceChange(null);
                  void run(() => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/jobs/${pmJob.id}/pm-service`, {
                    method: 'POST',
                    body: JSON.stringify({ catalogJobId: back }),
                  }));
                }}
              >
                {messages.undoAction}
              </Button>
            </p>
          ) : null}
        </div>
      ) : null}

      {needsContinue ? (
        <section className="card mb-4 space-y-3" data-testid="pm-continue">
          {stoppedLine ? <p className="text-sm font-medium" role="status">{stoppedLine}</p> : null}
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => void run(
              () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/jobs/${pmJob.id}/pm/start`, { method: 'POST' }),
              () => showToast('success', messages.workStartedSuccess),
            )}
          >
            {busy ? messages.startingWork : messages.continueWork}
          </Button>
        </section>
      ) : null}

      {activeBlocker ? (
        <section className="mb-4 space-y-2 rounded-xl border border-warning/50 bg-warning-surface px-4 py-3 text-sm text-warning-foreground" aria-label={messages.activeBlockers} data-testid="active-blocker">
          <p className="font-medium">{messages.blockedWithReason(pauseLabel(activeBlocker.blockerReason ?? activeBlocker.reason, messages.pauseReason) ?? '')}</p>
          <p className="text-xs">{messages.blockerSinceBy(new Intl.DateTimeFormat(intlLocale(messages.locale), { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(activeBlocker.startedAt)), activeBlocker.reportedBy?.name ?? '—')}</p>
          {(activeBlocker.blockerNotes ?? []).map((note) => <p key={note.id}>{note.author.name}: {note.body}</p>)}
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!noteDraft.trim()) return;
              void run(
                () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/blockers/${activeBlocker.id}/notes`, {
                  method: 'POST', body: JSON.stringify({ body: noteDraft.trim() }),
                }),
                () => { setNoteDraft(''); showToast('success', messages.blockerNoteAdded); },
              );
            }}
          >
            <Textarea aria-label={messages.addBlockerNote} placeholder={messages.blockerNotePlaceholder} rows={2} value={noteDraft} disabled={busy} onChange={(event) => setNoteDraft(event.target.value)} />
            <Button type="submit" variant="secondary" disabled={busy || !noteDraft.trim()}>{messages.addBlockerNote}</Button>
          </form>
        </section>
      ) : null}

      {started ? (
        <PmServiceCard workOrderId={wo.id} onDraftStateChange={setDraft} />
      ) : (
        <section className="card mb-4 space-y-3">
          <p className="text-sm text-muted-foreground">{messages.pmJobNotStartedHint}</p>
          {otherRunningPm ? <PmInProgressNotice running={otherRunningPm} /> : null}
          <Button
            className="w-full"
            variant={otherRunningPm ? 'secondary' : undefined}
            disabled={busy || Boolean(otherRunningPm)}
            onClick={() => void run(
              () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/jobs/${pmJob.id}/pm/start`, { method: 'POST' }),
              () => showToast('success', messages.pmServiceStartedSuccess),
            )}
          >
            {busy ? messages.startingWork : messages.startPmService}
          </Button>
        </section>
      )}

      {finished ? (
        <p className="mb-4 rounded-xl bg-shop-success/10 px-3 py-2 text-sm text-shop-success">{messages.pmJobFinishedHint}</p>
      ) : null}

      {/* LTR-158: the PM comes first; truck data is folded below it. */}
      <details className="card mb-4" aria-labelledby="pm-job-truck-information">
        <summary id="pm-job-truck-information" className="group-title cursor-pointer select-none">{messages.truckInformation}</summary>
        <div className="mt-3 space-y-3">
          <TruckInformationFields truck={wo.truck} locale={messages.locale} />
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/trucks/${wo.truckId}/history?from=${encodeURIComponent(`/work-orders/${wo.id}`)}`}>
              {messages.repairHistory}
            </Link>
          </Button>
        </div>
      </details>

      {/* LTR-189 (W15): the PM mechanic leaves notes and asks for work like any other mechanic. */}
      <WorkOrderNotesThread wo={wo} onUpdated={onUpdated} />


      {started && !finished ? (
        // Stage PM-2 (UX-4-001, UX-7-006): Finish stays at hand, and says exactly what it waits for.
        <section
          className="sticky bottom-0 z-30 -mx-4 mt-4 space-y-2 border-t bg-card/95 px-4 pb-[calc(0.75rem+var(--app-safe-bottom))] pt-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border"
          aria-label="PM job actions"
          data-testid="pm-finish-bar"
        >
          <p className={`text-sm ${finishBlocked ? 'text-muted-foreground' : 'font-medium text-success'}`} data-testid="pm-finish-reason">{finishReason}</p>
          <div className="flex gap-2">
            {!activeBlocker ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => { setBlockerReason(''); setBlockerNotesError(false); setBlockerOpen(true); }}>
                <CircleAlert aria-hidden="true" />{messages.reportBlocker}
              </Button>
            ) : null}
            <Button className="flex-1" disabled={finishBlocked} onClick={() => setFinishOpen(true)}>
              <CheckCheck aria-hidden="true" />{messages.finishPm}
            </Button>
          </div>
        </section>
      ) : null}

      <Modal
        open={blockerOpen}
        title={messages.reportBlockerFor(pmJob.displayName)}
        description={messages.blockerSheetHint}
        closeLabel={messages.closeDialog}
        onClose={() => { if (!busy) { setBlockerOpen(false); setError(null); } }}
      >
        {/* Stage PM-2 (UX-7-009): big options and the note always there, required only with "Other". */}
        <fieldset className="mb-3">
          <legend className="mb-2 text-sm font-medium">{messages.blockerReason}</legend>
          <div className="space-y-1.5" role="radiogroup" aria-label={messages.blockerReason}>
            {MECHANIC_BLOCKER_REASONS.map((reason) => (
              <label key={reason} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm ${blockerReason === reason ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent'}`}>
                <input type="radio" name="pm-blocker-reason" value={reason} checked={blockerReason === reason} disabled={busy} className="size-4 accent-primary" onChange={() => { setBlockerReason(reason); setBlockerNotesError(false); }} />
                {messages.pauseReason[reason as unknown as PauseReason]}
              </label>
            ))}
          </div>
        </fieldset>
        <Label className="mb-2 block" htmlFor="pm-blocker-notes">{blockerReason === BlockerReason.OTHER ? messages.blockerNoteRequiredLabel : messages.blockerNoteOptionalLabel}</Label>
        <Textarea
          id="pm-blocker-notes"
          placeholder={blockerReason === BlockerReason.OTHER ? messages.reasonRequiredForOther : messages.blockerReportPlaceholder}
          value={blockerNotes}
          disabled={busy}
          aria-invalid={blockerNotesError || undefined}
          onChange={(event) => { setBlockerNotes(event.target.value); setBlockerNotesError(false); }}
        />
        {blockerNotesError ? <p className="mt-2 text-sm text-destructive-text" role="alert">{messages.blockerNoteRequired}</p> : null}
        {!blockerReason ? <p className="mt-3 text-sm text-muted-foreground">{messages.blockerReasonRequiredHint}</p> : null}
        <DialogActions className="mt-4">
          <Button variant="outline" disabled={busy} onClick={() => setBlockerOpen(false)}>{messages.cancelAction}</Button>
          <Button
            disabled={busy || !blockerReason}
            onClick={() => {
              if (blockerReason === BlockerReason.OTHER && !blockerNotes.trim()) { setBlockerNotesError(true); return; }
              void run(
                () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/blockers`, {
                  method: 'POST',
                  body: JSON.stringify({ jobId: pmJob.id, reason: blockerReason, notes: blockerNotes.trim() || undefined }),
                }),
                () => { setBlockerNotes(''); setBlockerOpen(false); showToast('success', messages.blockerReportedSuccess); },
              );
            }}
          >
            {busy ? messages.reportingBlocker : messages.reportBlocker}
          </Button>
        </DialogActions>
      </Modal>

      <Modal
        open={finishOpen}
        title={messages.finishConfirmTitle(pmJob.displayName.replace(/ Service$/i, ''), wo.truckNumber)}
        description={messages.finishConfirmHint}
        closeLabel={messages.closeDialog}
        onClose={() => { if (!busy) { setFinishOpen(false); setError(null); } }}
      >
        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}
        {/* Stage PM-2 (UX-7-007): what stays recorded, before it is read-only. */}
        <dl className="mb-4 space-y-2 rounded-lg border bg-muted/40 p-3 text-sm" data-testid="pm-finish-summary">
          <div>
            <dt className="text-xs text-muted-foreground">{messages.observedMileage}</dt>
            <dd className="font-medium">{formatMileage(mileage)}</dd>
            <dd className="text-xs text-muted-foreground">
              {mileageChangesTruck ? messages.truckGoes(formatMileage(wo.truck.mileage), formatMileage(mileage)) : messages.truckStays(formatMileage(mileage))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{messages.pmPartsLabel}</dt>
            {(draft.parts ?? []).map((part) => <dd key={part.category} className="font-medium">{part.category} — {part.label}</dd>)}
          </div>
        </dl>
        <DialogActions>
          <Button variant="outline" disabled={busy} onClick={() => { if (!busy) setFinishOpen(false); }}>{messages.qc.back}</Button>
          <Button
            disabled={busy}
            onClick={() => void run(
              () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/jobs/${pmJob.id}/complete`, { method: 'POST', body: JSON.stringify({}) }),
              () => {
                setFinishOpen(false);
                showToast('success', messages.pmFinishedSuccess);
                router.replace('/mechanic/pm', { scroll: true });
              },
            )}
          >
            <CheckCheck aria-hidden="true" />{busy ? messages.finishingWork : messages.finishPm}
          </Button>
        </DialogActions>
      </Modal>
    </div>
  );
}
