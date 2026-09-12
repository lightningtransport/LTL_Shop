'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CircleHelp, Info as InfoIcon, ShieldCheck } from 'lucide-react';
import { AppCapability, ReadinessAssessmentStatus, ReadinessRequirementOutcome, ReadinessRequirementType, TruckOperationalStatus, type AdminTruckDetailDto, type ReadinessRequirementDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { closeAdminTruckAssessment, markAdminTruckReady, startAdminTruckAssessment, updateAdminTruckRequirement, useAdminTruck } from '@/lib/admin-data';
import { formatAdminDate, formatAdminDateOnly } from '@/lib/admin-format';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, LoadFailure, PageSkeleton, Select, Textarea } from './ui';

const phaseKey = { needs_evaluation: 'needsEvaluation', inspection: 'inspection', required_work: 'requiredWork', pm: 'pm', alignment: 'alignment', detailing: 'detailing', quality_check: 'qualityCheck', ready_for_approval: 'readyForApproval', ready_to_go: 'readyToGo' } as const;
const requirementKey = { inspection: 'inspection', required_repairs: 'requiredWork', pm: 'pm', alignment: 'alignment', detailing: 'detailing', quality_check: 'qualityCheck' } as const;
const outcomeKey = { not_evaluated: 'notEvaluatedOutcome', required: 'requiredOutcome', not_required: 'notRequiredOutcome', completed: 'completedOutcome', waived: 'waivedOutcome' } as const;
const statusKey = { created: 'created', in_progress: 'inProgress', waiting_paused: 'waitingPaused', completed: 'completed', cancelled: 'cancelled' } as const;
const priorityKey = { low: 'lowPriority', normal: 'normalPriority', high: 'highPriority', critical: 'criticalPriority' } as const;
const pauseKey = { waiting_for_parts: 'waitingForParts', waiting_for_approval: 'waitingForApproval', waiting_for_vendor: 'waitingForVendor', waiting_for_equipment: 'waitingForEquipment', waiting_for_bay: 'waitingForBay', waiting_for_driver: 'waitingForDriver', truck_unavailable: 'truckUnavailable', working_on_another_wo: 'workingOnAnotherWorkOrder', break: 'breakPause', end_of_shift: 'endOfShift', other: 'otherPause' } as const;
const requirementTypes = Object.values(ReadinessRequirementType) as ReadinessRequirementType[];
const outcomes = Object.values(ReadinessRequirementOutcome) as ReadinessRequirementOutcome[];

type Feedback = { kind: 'success' | 'error'; message: string };

export function AdminTruckDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useAdminTruck(id);
  const canManage = Boolean(user?.capabilities.includes(AppCapability.YARD_OPERATIONS_MANAGE));
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { outcome: ReadinessRequirementOutcome; waiverReason: string; evidenceWorkOrderId: string }>>({});

  if (isLoading) return <PageSkeleton label={messages.loadingTruck} />;
  if (error instanceof ApiError && error.status === 404) return <TruckNotFound messages={messages} />;
  if (error || !data) return <LoadFailure message={messages.yardLoadError} retryLabel={messages.retryTruck} onRetry={() => void mutate()} />;

  const assessment = data.assessment;
  const truckId = data.truck.id;
  const isActive = assessment?.status === ReadinessAssessmentStatus.UNDER_REVIEW || assessment?.status === ReadinessAssessmentStatus.READY;
  const currentWork = data.activeWorkOrder;
  const readinessIncomplete = Boolean(assessment?.requirements.some((requirement) => [ReadinessRequirementOutcome.NOT_EVALUATED, ReadinessRequirementOutcome.REQUIRED].includes(requirement.outcome)));

  function draftFor(requirement: ReadinessRequirementDto) {
    return drafts[requirement.id] ?? { outcome: requirement.outcome, waiverReason: requirement.waiverReason ?? '', evidenceWorkOrderId: requirement.evidenceWorkOrderId ?? '' };
  }

  function updateDraft(requirement: ReadinessRequirementDto, patch: Partial<ReturnType<typeof draftFor>>) {
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
    if (!assessment || !window.confirm(messages.markReadyConfirmation)) return;
    await runMutation('ready', messages.readySuccess, () => markAdminTruckReady(assessment.id, assessment.version));
  }

  async function handleClose(event: React.FormEvent) {
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
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="font-display text-3xl font-bold tracking-wide">{data.truck.truckNumber}</h1><Badge variant={data.blockers.length ? 'warning' : 'success'}>{messages[phaseKey[data.phase]]}</Badge></div>
      <p className="mt-2 text-sm text-muted-foreground">{[data.truck.year, data.truck.make, data.truck.model].filter(Boolean).join(' ') || messages.noValue}</p>
    </header>

    {feedback ? <div className={feedback.kind === 'error' ? 'rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive' : 'rounded-xl border border-shop-success/30 bg-shop-success/10 px-3 py-2 text-sm text-shop-success'} role={feedback.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{feedback.message}{feedback.kind === 'error' && messageIsConflict(feedback.message, messages) ? <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void mutate()}>{messages.reloadTruck}</Button> : null}</div> : null}

    <Card className="border-warning/50 bg-warning-surface"><CardHeader className="mb-0 flex flex-row items-start gap-3"><CircleHelp aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning-foreground" /><div><CardTitle className="text-base">{messages.physicalPresenceUnavailable}</CardTitle><CardDescription className="mt-1 text-warning-foreground">{messages.phase1PresenceDetail}</CardDescription></div></CardHeader></Card>

    <section className="grid items-start gap-4 xl:grid-cols-2" aria-label={messages.truckOverview}>
      <Card><CardHeader><CardTitle>{messages.truckOverview}</CardTitle></CardHeader><CardContent><dl className="grid gap-4 text-sm sm:grid-cols-2"><Info label={messages.truckNumber} value={data.truck.truckNumber} /><Info label={messages.make} value={data.truck.make ?? messages.noValue} /><Info label={messages.model} value={data.truck.model ?? messages.noValue} /><Info label={messages.year} value={data.truck.year ? String(data.truck.year) : messages.noValue} /><Info label={messages.mileage} value={formatNumber(data.truck.mileage, locale, messages)} /><Info label={messages.company} value={data.truck.company ?? messages.noValue} /><Info label={messages.owner} value={data.truck.owner ?? messages.noValue} /><Info label={messages.vin} value={data.truck.vin ?? messages.noValue} /><Info label={messages.lastReportedLocation} value={data.truck.location ?? messages.noValue} /><Info label={messages.locationUpdatedOn} value={formatAdminDateOnly(data.truck.locationUpdatedOn, locale)} /><Info label={messages.operationalStatus} value={operationalStatusLabel(data.operationalStatus, messages)} /><Info label={messages.presenceUnknown} value={messages.presenceUnknownDetail} /></dl></CardContent></Card>
      <Card><CardHeader><CardTitle>{messages.currentWork}</CardTitle><CardDescription>{messages.currentWorkDescription}</CardDescription></CardHeader><CardContent>{currentWork ? <div className="space-y-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><Link className="font-semibold text-primary hover:underline" href={`/admin/work-orders/${currentWork.id}`}>{currentWork.displayId}</Link><div className="flex gap-2"><Badge variant="outline">{localizedStatus(currentWork.status, messages)}</Badge><Badge variant="outline">{messages[priorityKey[currentWork.priority]]}</Badge></div></div><Info label={messages.category} value={currentWork.category.name} /><Info label={messages.mechanicsLabel} value={currentWork.mechanics.map((mechanic) => mechanic.mechanicName).join(', ') || messages.noMechanicsAssigned} />{currentWork.currentPause ? <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground">{messages.currentPause}: {localizedStatus(currentWork.currentPause.reason, messages)} · {formatAdminDate(currentWork.currentPause.startedAt, locale)}</p> : null}</div> : <EmptyState>{messages.noCurrentWork}</EmptyState>}</CardContent></Card>
    </section>

    <section aria-labelledby="truck-readiness-title"><Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle id="truck-readiness-title">{messages.readinessSection}</CardTitle><CardDescription>{messages.readinessDescription}</CardDescription></div>{canManage && !assessment ? <Button type="button" onClick={() => void handleStart()} disabled={Boolean(pendingAction)}>{pendingAction === 'start' ? messages.starting : messages.startAssessment}</Button> : null}</div></CardHeader><CardContent>{assessment ? <div className="space-y-4"><div className="flex flex-wrap items-center gap-2 text-sm"><Badge variant={assessment.status === ReadinessAssessmentStatus.READY ? 'success' : 'outline'}>{localizedAssessmentStatus(assessment.status, messages)}</Badge><span className="text-muted-foreground">{messages.startedAtLabel}: {formatAdminDate(assessment.startedAt, locale)}</span><span className="text-muted-foreground">v{assessment.version}</span></div><div className="space-y-3">{requirementTypes.map((type) => { const requirement = assessment.requirements.find((candidate) => candidate.type === type); return requirement ? <RequirementEditor key={requirement.id} requirement={requirement} messages={messages} canManage={canManage && assessment.status !== ReadinessAssessmentStatus.CLOSED} draft={draftFor(requirement)} disabled={Boolean(pendingAction)} onChange={(patch) => updateDraft(requirement, patch)} onSave={() => void handleRequirement(requirement)} /> : null; })}</div>{canManage && isActive ? <div className="flex flex-wrap gap-2 border-t pt-4">{assessment.status === ReadinessAssessmentStatus.UNDER_REVIEW ? <Button type="button" onClick={() => void handleReady()} disabled={Boolean(pendingAction) || !assessment.requirements.every((requirement) => ![ReadinessRequirementOutcome.NOT_EVALUATED, ReadinessRequirementOutcome.REQUIRED].includes(requirement.outcome)) || Boolean(currentWork)}>{pendingAction === 'ready' ? messages.saving : messages.markReady}</Button> : null}<Button type="button" variant="destructive" onClick={() => setCloseOpen((current) => !current)} disabled={Boolean(pendingAction)}>{messages.closeAssessment}</Button></div> : null}{closeOpen ? <form className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3" onSubmit={handleClose}><label className="block space-y-1"><span className="text-sm font-medium">{messages.closeAssessmentReason}</span><Textarea required value={closeReason} onChange={(event) => setCloseReason(event.target.value)} aria-describedby="close-assessment-help" /><span id="close-assessment-help" className="text-xs text-muted-foreground">{messages.closeAssessmentDescription}</span></label><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCloseOpen(false)}>{messages.cancel}</Button><Button type="submit" variant="destructive" disabled={Boolean(pendingAction)}>{pendingAction === 'close' ? messages.saving : messages.confirmCloseAssessment}</Button></div></form> : null}</div> : <EmptyState><p>{messages.noRequirements}</p>{!canManage ? <p className="mt-2 text-sm">{messages.permissionReadOnly}</p> : null}</EmptyState>}{!canManage && assessment ? <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"><InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{messages.permissionReadOnly}</p> : null}</CardContent></Card></section>

    <section aria-labelledby="truck-blockers-title"><Card><CardHeader><CardTitle id="truck-blockers-title">{messages.blockersSection}</CardTitle><CardDescription>{messages.blockersDescription}</CardDescription></CardHeader><CardContent>{data.blockers.length ? <ul className="space-y-2">{data.blockers.map((blocker, index) => <li key={`${blocker.kind}-${index}`} className="flex items-start gap-2 text-sm"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-foreground" /><span>{localizeBlocker(blocker, messages)}</span></li>)}</ul> : <EmptyState><ShieldCheck aria-hidden="true" className="mx-auto mb-2 size-5 text-shop-success" />{messages.noBlockerRecorded}</EmptyState>}</CardContent></Card></section>

    <section aria-labelledby="truck-history-title"><Card><CardHeader><CardTitle id="truck-history-title">{messages.repairHistorySection}</CardTitle><CardDescription>{messages.repairHistorySectionDescription}</CardDescription></CardHeader><CardContent>{data.repairHistory.items.length ? <ul className="divide-y">{data.repairHistory.items.map((item) => <li key={item.workOrderId} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"><div><Link className="font-semibold text-primary hover:underline" href={`/admin/work-orders/${item.workOrderId}`}>{item.displayId}</Link><p className="text-sm text-muted-foreground">{item.primaryCategoryName} · {formatAdminDate(item.date, locale)}</p>{item.jobDetails?.length ? <p className="mt-1 text-sm text-muted-foreground">{item.jobDetails.map((job) => `${job.category.name}: ${job.displayName}`).join(' · ')}</p> : null}</div><div className="text-right text-xs text-muted-foreground">{item.mileage === null ? messages.noValue : `${messages.mileage}: ${formatNumber(item.mileage, locale, messages)}`}</div></li>)}</ul> : <EmptyState>{messages.noRepairHistoryForTruck}</EmptyState>}</CardContent></Card></section>
  </div>;
}

function RequirementEditor({ requirement, messages, canManage, draft, disabled, onChange, onSave }: { requirement: ReadinessRequirementDto; messages: AdminMessages; canManage: boolean; draft: { outcome: ReadinessRequirementOutcome; waiverReason: string; evidenceWorkOrderId: string }; disabled: boolean; onChange: (patch: Partial<{ outcome: ReadinessRequirementOutcome; waiverReason: string; evidenceWorkOrderId: string }>) => void; onSave: () => void }) {
  const isEvidence = evidenceRequired(requirement.type, draft.outcome);
  return <div className="rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-medium">{messages[requirementKey[requirement.type]]}</h3><p className="text-xs text-muted-foreground">{messages.requirementOutcome}: {messages[outcomeKey[draft.outcome]]} · v{requirement.version}</p></div>{!canManage ? <Badge variant="outline">{messages.readOnly}</Badge> : null}</div>{canManage ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-xs font-medium">{messages.requirementOutcome}</span><Select aria-label={`${messages.requirementOutcome}: ${messages[requirementKey[requirement.type]]}`} value={draft.outcome} disabled={disabled} onChange={(event) => onChange({ outcome: event.target.value as ReadinessRequirementOutcome })}>{outcomes.map((outcome) => <option key={outcome} value={outcome}>{messages[outcomeKey[outcome]]}</option>)}</Select></label>{draft.outcome === ReadinessRequirementOutcome.WAIVED ? <label className="space-y-1"><span className="text-xs font-medium">{messages.waiverReason}</span><Input value={draft.waiverReason} disabled={disabled} onChange={(event) => onChange({ waiverReason: event.target.value })} required aria-describedby={`waiver-help-${requirement.id}`} /><span id={`waiver-help-${requirement.id}`} className="text-xs text-muted-foreground">{messages.waiverReasonRequired}</span></label> : null}{isEvidence ? <label className="space-y-1 sm:col-span-2"><span className="text-xs font-medium">{messages.evidenceWorkOrderId}</span><Input value={draft.evidenceWorkOrderId} disabled={disabled} onChange={(event) => onChange({ evidenceWorkOrderId: event.target.value })} required aria-describedby={`evidence-help-${requirement.id}`} /><span id={`evidence-help-${requirement.id}`} className="text-xs text-muted-foreground">{messages.evidenceWorkOrderHelp}</span></label> : null}<div className="flex justify-end sm:col-span-2"><Button type="button" size="sm" onClick={onSave} disabled={disabled}>{disabled ? messages.saving : messages.updateRequirement}</Button></div></div> : null}</div>;
}

function evidenceRequired(type: ReadinessRequirementType, outcome: ReadinessRequirementOutcome) {
  return outcome === ReadinessRequirementOutcome.COMPLETED && [ReadinessRequirementType.PM, ReadinessRequirementType.ALIGNMENT, ReadinessRequirementType.REQUIRED_REPAIRS].includes(type);
}

function localizeBlocker(blocker: AdminTruckDetailDto['blockers'][number], messages: AdminMessages) {
  const base = blocker.kind === 'open_work_order' ? messages.openWorkOrderBlocker : blocker.kind === 'required_requirement' ? messages.requiredRequirementBlocker : blocker.kind === 'unevaluated_requirement' ? messages.unevaluatedRequirementBlocker : messages.approvalConflictBlocker;
  return `${base}${blocker.categoryName ? ` ${blocker.categoryName}` : ''}${blocker.status ? ` · ${localizedStatus(blocker.status, messages)}` : ''}${blocker.requirementType ? ` · ${messages[requirementKey[blocker.requirementType]]}` : ''}`;
}

function localizedStatus(value: string, messages: AdminMessages) {
  if (value in statusKey) return messages[statusKey[value as keyof typeof statusKey]];
  return value in pauseKey ? messages[pauseKey[value as keyof typeof pauseKey]] : value;
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
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }
function TruckNotFound({ messages }: { messages: AdminMessages }) { return <EmptyState><p>{messages.notFoundTruck}</p><Button asChild variant="outline" className="mt-4"><Link href="/admin/yard-operations">{messages.backToYardOperations}</Link></Button></EmptyState>; }
