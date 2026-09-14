'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowLeft, Info as InfoIcon, ShieldCheck } from 'lucide-react';
import {
  AppCapability,
  ReadinessAssessmentStatus,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  TruckOperationalStatus,
  type AdminTruckDetailDto,
  type ReadinessRequirementDto,
} from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { closeAdminTruckAssessment, markAdminTruckReady, startAdminTruckAssessment, updateAdminTruckRequirement, useAdminTruck } from '@/lib/admin-data';
import { formatAdminDate, formatAdminDateOnly } from '@/lib/admin-format';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import {
  collapseReadinessBlockers,
  evidenceRequired,
  gateLabel,
  hasUnevaluatedGate,
  localizeReadinessBlocker,
  markReadyBlockState,
  newWorkOrderHref,
  outcomeHelp,
  OUTCOME_MESSAGE_KEY,
  READINESS_OUTCOMES,
  READINESS_REQUIREMENT_TYPES,
  readinessGateDomId,
  requiredNeedsWorkOrder,
  rowBlockerForType,
  withGateName,
  type CompletedWorkOrderOption,
} from '@/lib/admin-truck-readiness';
import { adminPriorityLabel, phaseLabel, workOrderStatusLabel } from '@/lib/status-chips';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, CompactEmpty, EmptyState, Input, LoadFailure, PageSkeleton, PhaseBadge, PriorityBadge, Select, Textarea, WorkOrderStatusBadge } from './ui';

type Feedback = { kind: 'success' | 'error'; message: string };
type RequirementDraft = { outcome: ReadinessRequirementOutcome; waiverReason: string; evidenceWorkOrderId: string };

export function AdminTruckDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useAdminTruck(id);
  const canManage = Boolean(user?.capabilities.includes(AppCapability.YARD_OPERATIONS_MANAGE));
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [drafts, setDrafts] = useState<Record<string, RequirementDraft>>({});

  if (isLoading) return <PageSkeleton label={messages.loadingTruck} />;
  if (error instanceof ApiError && error.status === 404) return <TruckNotFound messages={messages} />;
  if (error || !data) return <LoadFailure message={messages.yardLoadError} retryLabel={messages.retryTruck} onRetry={() => void mutate()} />;

  const assessment = data.assessment;
  const truckId = data.truck.id;
  const isActive = assessment?.status === ReadinessAssessmentStatus.UNDER_REVIEW || assessment?.status === ReadinessAssessmentStatus.READY;
  const currentWork = data.activeWorkOrder;
  const completedWorkOrders: CompletedWorkOrderOption[] = data.repairHistory.items.map((item) => ({
    id: item.workOrderId,
    displayId: item.displayId,
  }));
  const readyState = markReadyBlockState(assessment?.requirements ?? [], Boolean(currentWork));
  const showUnevaluatedBanner = Boolean(
    assessment
    && assessment.status === ReadinessAssessmentStatus.UNDER_REVIEW
    && hasUnevaluatedGate(assessment.requirements),
  );
  const { rowBlockers, listBlockers } = collapseReadinessBlockers(data.blockers);
  const blockerList = listBlockers.length ? listBlockers : rowBlockers;

  function draftFor(requirement: ReadinessRequirementDto): RequirementDraft {
    return drafts[requirement.id] ?? {
      outcome: requirement.outcome,
      waiverReason: requirement.waiverReason ?? '',
      evidenceWorkOrderId: requirement.evidenceWorkOrderId ?? '',
    };
  }

  function updateDraft(requirement: ReadinessRequirementDto, patch: Partial<RequirementDraft>) {
    setDrafts((current) => ({
      ...current,
      [requirement.id]: {
        ...(current[requirement.id] ?? {
          outcome: requirement.outcome,
          waiverReason: requirement.waiverReason ?? '',
          evidenceWorkOrderId: requirement.evidenceWorkOrderId ?? '',
        }),
        ...patch,
      },
    }));
  }

  function mutationError(errorValue: unknown) {
    if (errorValue instanceof ApiError) {
      if (errorValue.status === 400) return messages.mutationBadRequest;
      if (errorValue.status === 403) return messages.mutationForbidden;
      if (errorValue.status === 404) return messages.mutationNotFound;
      if (errorValue.status === 409) return messages.mutationConflict;
    }
    return messages.mutationGenericError;
  }

  async function runMutation(action: string, successMessage: string, operation: () => Promise<unknown>) {
    if (pendingAction) return;
    setPendingAction(action);
    setFeedback(null);
    try {
      await operation();
      await mutate();
      setFeedback({ kind: 'success', message: successMessage });
    } catch (mutationFailure) {
      setFeedback({ kind: 'error', message: mutationError(mutationFailure) });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStart() {
    if (!window.confirm(messages.startAssessmentConfirmation)) return;
    await runMutation('start', messages.assessmentStartedSuccess, () => startAdminTruckAssessment(truckId));
  }

  async function handleRequirement(requirement: ReadinessRequirementDto) {
    const draft = draftFor(requirement);
    const needsEvidence = evidenceRequired(requirement.type, draft.outcome);
    if (draft.outcome === ReadinessRequirementOutcome.WAIVED && !draft.waiverReason.trim()) {
      setFeedback({ kind: 'error', message: messages.waiverReasonRequired });
      return;
    }
    if (needsEvidence && !draft.evidenceWorkOrderId.trim()) {
      setFeedback({ kind: 'error', message: messages.evidenceWorkOrderRequired });
      return;
    }
    await runMutation(`requirement:${requirement.id}`, messages.requirementUpdatedSuccess, () => updateAdminTruckRequirement(assessment!.id, requirement.type, {
      outcome: draft.outcome,
      expectedVersion: requirement.version,
      ...(draft.outcome === ReadinessRequirementOutcome.WAIVED && draft.waiverReason.trim() ? { waiverReason: draft.waiverReason.trim() } : {}),
      ...(draft.outcome === ReadinessRequirementOutcome.COMPLETED && draft.evidenceWorkOrderId.trim() ? { evidenceWorkOrderId: draft.evidenceWorkOrderId.trim() } : {}),
    }));
  }

  async function handleReady() {
    if (!assessment || readyState.disabled || !window.confirm(messages.markReadyConfirmation)) return;
    await runMutation('ready', messages.readySuccess, () => markAdminTruckReady(assessment.id, assessment.version));
  }

  async function handleClose(event: FormEvent) {
    event.preventDefault();
    if (!assessment) return;
    if (!closeReason.trim()) {
      setFeedback({ kind: 'error', message: messages.closeAssessmentReasonRequired });
      return;
    }
    if (!window.confirm(messages.closeAssessmentConfirmation)) return;
    await runMutation('close', messages.assessmentClosedSuccess, () => closeAdminTruckAssessment(assessment.id, assessment.version, closeReason.trim()));
    setCloseOpen(false);
    setCloseReason('');
  }

  return <div className="space-y-5">
    <div><Button asChild variant="ghost" className="-ml-3"><Link href="/admin/yard-operations"><ArrowLeft aria-hidden="true" className="size-4" />{messages.backToYardOperations}</Link></Button></div>
    <header>
      <p className="section-label">{messages.yardOperationsTitle}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="font-display text-3xl font-bold tracking-wide">{data.truck.truckNumber}</h1><PhaseBadge phase={data.phase}>{phaseLabel(data.phase, messages)}</PhaseBadge></div>
      <p className="mt-2 text-sm text-muted-foreground">{[data.truck.year, data.truck.make, data.truck.model].filter(Boolean).join(' ') || messages.noValue}</p>
    </header>

    {feedback ? <div className={feedback.kind === 'error' ? 'rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive' : 'rounded-xl border border-shop-success/30 bg-shop-success/10 px-3 py-2 text-sm text-shop-success'} role={feedback.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{feedback.message}{feedback.kind === 'error' && messageIsConflict(feedback.message, messages) ? <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void mutate()}>{messages.reloadTruck}</Button> : null}</div> : null}

    <section className="grid items-start gap-4 xl:grid-cols-2" aria-label={messages.truckOverview}>
      <Card><CardHeader><CardTitle>{messages.truckOverview}</CardTitle></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><Info label={messages.truckNumber} value={data.truck.truckNumber} /><Info label={messages.make} value={data.truck.make ?? messages.noValue} /><Info label={messages.model} value={data.truck.model ?? messages.noValue} /><Info label={messages.year} value={data.truck.year ? String(data.truck.year) : messages.noValue} /><Info label={messages.mileage} value={formatNumber(data.truck.mileage, locale, messages)} /><Info label={messages.company} value={data.truck.company ?? messages.noValue} /><Info label={messages.owner} value={data.truck.owner ?? messages.noValue} /><Info label={messages.vin} value={data.truck.vin ?? messages.noValue} /><Info label={messages.lastReportedLocation} value={data.truck.location ?? messages.noValue} /><Info label={messages.locationUpdatedOn} value={formatAdminDateOnly(data.truck.locationUpdatedOn, locale)} /><Info label={messages.operationalStatus} value={operationalStatusLabel(data.operationalStatus, messages)} /></dl></CardContent></Card>
      <Card><CardHeader><CardTitle>{messages.currentWork}</CardTitle><CardDescription>{messages.currentWorkDescription}</CardDescription></CardHeader><CardContent>{currentWork ? <div className="space-y-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><Link className="font-semibold text-primary hover:underline" href={`/admin/work-orders/${currentWork.id}`}>{currentWork.displayId}</Link><div className="flex gap-2"><WorkOrderStatusBadge status={currentWork.status}>{workOrderStatusLabel(currentWork.status, messages)}</WorkOrderStatusBadge><PriorityBadge priority={currentWork.priority}>{adminPriorityLabel(currentWork.priority, messages)}</PriorityBadge></div></div><Info label={messages.category} value={currentWork.category.name} /><Info label={messages.mechanicsLabel} value={currentWork.mechanics.map((mechanic) => mechanic.mechanicName).join(', ') || messages.noMechanicsAssigned} />{currentWork.currentPause ? <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground">{messages.currentPause}: {adminPauseReasonLabel(currentWork.currentPause.reason, messages)} · {formatAdminDate(currentWork.currentPause.startedAt, locale)}</p> : null}</div> : <CompactEmpty>{messages.noCurrentWork}</CompactEmpty>}</CardContent></Card>
    </section>

    <section aria-labelledby="truck-readiness-title">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="truck-readiness-title">{messages.readinessSection}</CardTitle>
              <CardDescription>{messages.readinessDescription}</CardDescription>
            </div>
            {canManage && !assessment ? <Button type="button" onClick={() => void handleStart()} disabled={Boolean(pendingAction)}>{pendingAction === 'start' ? messages.starting : messages.startAssessment}</Button> : null}
          </div>
        </CardHeader>
        <CardContent>
          {assessment ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={assessment.status === ReadinessAssessmentStatus.READY ? 'success' : 'outline'}>{localizedAssessmentStatus(assessment.status, messages)}</Badge>
                <span className="text-muted-foreground">{messages.startedAtLabel}: {formatAdminDate(assessment.startedAt, locale)}</span>
                <span className="text-muted-foreground">v{assessment.version}</span>
              </div>
              {showUnevaluatedBanner ? (
                <p className="flex items-start gap-2 rounded-xl border border-shop-accent/40 bg-shop-accent/10 px-3 py-2 text-sm" role="status">
                  <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {messages.unevaluatedGatesBanner}
                </p>
              ) : null}
              <div className="space-y-3">
                {READINESS_REQUIREMENT_TYPES.map((type) => {
                  const requirement = assessment.requirements.find((candidate) => candidate.type === type);
                  return requirement ? (
                    <RequirementEditor
                      key={requirement.id}
                      requirement={requirement}
                      messages={messages}
                      canManage={canManage && assessment.status !== ReadinessAssessmentStatus.CLOSED}
                      draft={draftFor(requirement)}
                      disabled={Boolean(pendingAction)}
                      truckId={truckId}
                      currentWork={currentWork ? { id: currentWork.id, displayId: currentWork.displayId } : null}
                      completedWorkOrders={completedWorkOrders}
                      rowBlocker={rowBlockerForType(rowBlockers, requirement.type)}
                      onChange={(patch) => updateDraft(requirement, patch)}
                      onSave={() => void handleRequirement(requirement)}
                    />
                  ) : null;
                })}
              </div>
              {canManage && isActive ? (
                <div className="space-y-3 border-t pt-4">
                  {assessment.status === ReadinessAssessmentStatus.UNDER_REVIEW ? (
                    <MarkReadyControl
                      messages={messages}
                      readyState={readyState}
                      currentWork={currentWork}
                      pending={pendingAction === 'ready'}
                      disabled={Boolean(pendingAction) || readyState.disabled}
                      onReady={() => void handleReady()}
                    />
                  ) : null}
                  <Button type="button" variant="destructive" onClick={() => setCloseOpen(true)} disabled={Boolean(pendingAction)} aria-expanded={closeOpen} aria-controls="end-review-form">
                    {messages.closeAssessment}
                  </Button>
                </div>
              ) : null}
              {closeOpen ? (
                <form id="end-review-form" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3" onSubmit={handleClose}>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium">{messages.closeAssessmentReason}</span>
                    <Textarea required value={closeReason} onChange={(event) => setCloseReason(event.target.value)} aria-describedby="close-assessment-help" />
                    <span id="close-assessment-help" className="text-xs text-muted-foreground">{messages.closeAssessmentDescription}</span>
                  </label>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setCloseOpen(false)}>{messages.cancel}</Button>
                    <Button type="submit" variant="destructive" disabled={Boolean(pendingAction)}>{pendingAction === 'close' ? messages.saving : messages.confirmCloseAssessment}</Button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : (
            <CompactEmpty>
              <p>{messages.noRequirements}</p>
              {!canManage ? <p className="mt-2">{messages.permissionReadOnly}</p> : null}
            </CompactEmpty>
          )}
          {!canManage && assessment ? <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"><InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{messages.permissionReadOnly}</p> : null}
        </CardContent>
      </Card>
    </section>

    <section aria-labelledby="truck-blockers-title">
      <Card>
        <CardHeader>
          <CardTitle id="truck-blockers-title">{messages.blockersSection}</CardTitle>
          <CardDescription>{messages.blockersDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {blockerList.length ? (
            <ul className="space-y-2">
              {blockerList.map((blocker, index) => {
                const item = localizeReadinessBlocker(blocker, messages);
                return (
                  <li key={`${blocker.kind}-${index}`} className="flex items-start gap-2 text-sm">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                    {item.href ? <Link className="text-primary hover:underline" href={item.href}>{item.text}</Link> : <span>{item.text}</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <CompactEmpty><ShieldCheck aria-hidden="true" className="mb-1 inline size-4 text-shop-success" /> {messages.noBlockerRecorded}</CompactEmpty>
          )}
        </CardContent>
      </Card>
    </section>

    <section aria-labelledby="truck-history-title"><Card><CardHeader><CardTitle id="truck-history-title">{messages.repairHistorySection}</CardTitle><CardDescription>{messages.repairHistorySectionDescription}</CardDescription></CardHeader><CardContent>{data.repairHistory.items.length ? <ul className="divide-y">{data.repairHistory.items.map((item) => <li key={item.workOrderId} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"><div><Link className="font-semibold text-primary hover:underline" href={`/admin/work-orders/${item.workOrderId}`}>{item.displayId}</Link><p className="text-sm text-muted-foreground">{item.primaryCategoryName} · {formatAdminDate(item.date, locale)}</p>{item.jobDetails?.length ? <div className="mt-1 flex flex-wrap gap-1">{item.jobDetails.map((job) => <Badge key={`${item.workOrderId}-${job.displayName}`} variant="outline">{job.displayName}</Badge>)}</div> : null}</div><div className="text-right text-xs text-muted-foreground">{item.mileage === null ? messages.noValue : `${messages.mileage}: ${formatNumber(item.mileage, locale, messages)}`}</div></li>)}</ul> : <CompactEmpty>{messages.noRepairHistoryForTruck}</CompactEmpty>}</CardContent></Card></section>
  </div>;
}

function RequirementEditor({
  requirement,
  messages,
  canManage,
  draft,
  disabled,
  truckId,
  currentWork,
  completedWorkOrders,
  rowBlocker,
  onChange,
  onSave,
}: {
  requirement: ReadinessRequirementDto;
  messages: AdminMessages;
  canManage: boolean;
  draft: RequirementDraft;
  disabled: boolean;
  truckId: string;
  currentWork: { id: string; displayId: string } | null;
  completedWorkOrders: CompletedWorkOrderOption[];
  rowBlocker: AdminTruckDetailDto['blockers'][number] | null;
  onChange: (patch: Partial<RequirementDraft>) => void;
  onSave: () => void;
}) {
  const isEvidence = evidenceRequired(requirement.type, draft.outcome);
  const help = outcomeHelp(requirement.type, draft.outcome, messages);
  const savedRequired = requirement.outcome === ReadinessRequirementOutcome.REQUIRED;
  const showNextStep = savedRequired && draft.outcome === ReadinessRequirementOutcome.REQUIRED;
  const blockerCopy = rowBlocker ? localizeReadinessBlocker(rowBlocker, messages).text : null;
  const pickerIds = new Set(completedWorkOrders.map((item) => item.id));

  return (
    <div id={readinessGateDomId(requirement.type)} className="scroll-mt-24 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">{gateLabel(requirement.type, messages)}</h3>
          <p className="text-xs text-muted-foreground">{messages.requirementOutcome}: {messages[OUTCOME_MESSAGE_KEY[draft.outcome]]} · v{requirement.version}</p>
        </div>
        {!canManage ? <Badge variant="outline">{messages.readOnly}</Badge> : null}
      </div>
      {blockerCopy ? <p className="mt-2 text-sm text-muted-foreground">{blockerCopy}</p> : null}
      {canManage ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium">{messages.requirementOutcome}</span>
            <Select aria-label={`${messages.requirementOutcome}: ${gateLabel(requirement.type, messages)}`} value={draft.outcome} disabled={disabled} onChange={(event) => onChange({ outcome: event.target.value as ReadinessRequirementOutcome })}>
              {READINESS_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{messages[OUTCOME_MESSAGE_KEY[outcome]]}</option>)}
            </Select>
            {help ? <span className="block text-xs text-muted-foreground">{help}</span> : null}
          </label>
          {draft.outcome === ReadinessRequirementOutcome.WAIVED ? (
            <label className="space-y-1">
              <span className="text-xs font-medium">{messages.waiverReason}</span>
              <Input value={draft.waiverReason} disabled={disabled} onChange={(event) => onChange({ waiverReason: event.target.value })} required aria-describedby={`waiver-help-${requirement.id}`} />
              <span id={`waiver-help-${requirement.id}`} className="text-xs text-muted-foreground">{messages.waiverReasonRequired}</span>
            </label>
          ) : null}
          {showNextStep ? (
            <div className="space-y-2 rounded-lg bg-muted px-3 py-2 text-sm sm:col-span-2">
              <p>{requiredNeedsWorkOrder(requirement.type) ? messages.requiredNextStepNeedsWo : messages.requiredNextStepNoWo}</p>
              {requiredNeedsWorkOrder(requirement.type) ? (
                <div className="flex flex-wrap gap-2">
                  {currentWork ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/work-orders/${currentWork.id}`}>{messages.openWorkOrderForGate}: {currentWork.displayId}</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href={newWorkOrderHref(truckId)}>{messages.newWorkOrderCta}</Link>
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          {isEvidence ? (
            <div className="space-y-3 sm:col-span-2">
              {completedWorkOrders.length ? (
                <label className="block space-y-1">
                  <span className="text-xs font-medium">{messages.evidenceWorkOrderPicker}</span>
                  <Select
                    aria-label={messages.evidenceWorkOrderPicker}
                    value={pickerIds.has(draft.evidenceWorkOrderId) ? draft.evidenceWorkOrderId : ''}
                    disabled={disabled}
                    onChange={(event) => onChange({ evidenceWorkOrderId: event.target.value })}
                  >
                    <option value="">{messages.evidenceWorkOrderPickerPlaceholder}</option>
                    {completedWorkOrders.map((item) => <option key={item.id} value={item.id}>{item.displayId}</option>)}
                  </Select>
                </label>
              ) : null}
              <label className="block space-y-1">
                <span className="text-xs font-medium">{completedWorkOrders.length ? messages.evidenceWorkOrderPaste : messages.evidenceWorkOrderId}</span>
                <Input
                  value={draft.evidenceWorkOrderId}
                  disabled={disabled}
                  onChange={(event) => onChange({ evidenceWorkOrderId: event.target.value })}
                  required
                  aria-describedby={`evidence-help-${requirement.id}`}
                />
                <span id={`evidence-help-${requirement.id}`} className="text-xs text-muted-foreground">{messages.evidenceWorkOrderHelp}</span>
              </label>
            </div>
          ) : null}
          <div className="flex justify-end sm:col-span-2">
            <Button type="button" size="sm" onClick={onSave} disabled={disabled}>{disabled ? messages.saving : messages.updateRequirement}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MarkReadyControl({
  messages,
  readyState,
  currentWork,
  pending,
  disabled,
  onReady,
}: {
  messages: AdminMessages;
  readyState: ReturnType<typeof markReadyBlockState>;
  currentWork: AdminTruckDetailDto['activeWorkOrder'];
  pending: boolean;
  disabled: boolean;
  onReady: () => void;
}) {
  const reasonId = 'mark-ready-why';
  const firstGate = readyState.firstUnresolved ? gateLabel(readyState.firstUnresolved, messages) : null;
  return (
    <div className="space-y-2">
      <Button type="button" onClick={onReady} disabled={disabled} aria-describedby={readyState.disabled ? reasonId : undefined}>
        {pending ? messages.saving : messages.markReady}
      </Button>
      {readyState.disabled ? (
        <div id={reasonId} className="space-y-1 text-sm text-muted-foreground" role="status">
          {readyState.incomplete ? <p>{messages.readyRequirementsIncomplete}</p> : null}
          {firstGate && readyState.firstUnresolved ? (
            <p>
              <Link className="text-primary hover:underline" href={`#${readinessGateDomId(readyState.firstUnresolved)}`}>
                {withGateName(messages.readyFirstUnresolvedGate, firstGate)}
              </Link>
            </p>
          ) : null}
          {readyState.hasOpenWorkOrder ? (
            <p>
              {messages.readyOpenWorkOrder}
              {currentWork ? (
                <>
                  {' '}
                  <Link className="text-primary hover:underline" href={`/admin/work-orders/${currentWork.id}`}>{currentWork.displayId}</Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function localizedAssessmentStatus(value: ReadinessAssessmentStatus, messages: AdminMessages) {
  return value === ReadinessAssessmentStatus.READY ? messages.readyToGo : value === ReadinessAssessmentStatus.CLOSED ? messages.closedStatus : messages.underReview;
}

function operationalStatusLabel(status: TruckOperationalStatus, messages: AdminMessages) {
  if (status === TruckOperationalStatus.IN_SERVICE) return messages.operationalStatusInService;
  if (status === TruckOperationalStatus.OFF_DUTY) return messages.operationalStatusOffDuty;
  return messages.operationalStatusUnknown;
}

function formatNumber(value: number | null, locale: AdminLocale, messages: AdminMessages) {
  return value === null ? messages.noValue : new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US').format(value);
}

function messageIsConflict(message: string, messages: AdminMessages) { return message === messages.mutationConflict; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>; }
function TruckNotFound({ messages }: { messages: AdminMessages }) { return <EmptyState><p>{messages.notFoundTruck}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/yard-operations">{messages.backToYardOperations}</Link></Button></EmptyState>; }
