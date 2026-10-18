'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AppCapability, MIN_DAY_CLOSE_MINUTES, ShopWorkflowStepKey, UserRole, cutoffToMinutes, type ShopWorkflowStepDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { MechanicAvatar } from './mechanic-avatar';
import { PageHeader, Button, Card, CardContent, DialogActions, EmptyState, InlineAlert, Input, LoadFailure, Modal, PageSkeleton } from './ui';
import { updateAdminShopHours, updateAdminWorkflowSteps, useAdminRoster, useAdminShopHours, useAdminWorkflowSteps } from '@/lib/admin-data';
import { apiErrorMessage } from '@/lib/api-error-message';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { adminCountLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { useAuth } from '@/lib/auth-context';
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes-guard';
import { cn } from '@/lib/utils';
import { formatShortDateTime } from '@/lib/work-order-view';

/**
 * LTR-157 / D15, D16: Admin → Setup → Shop workflow. LTR-197 / D28: each mandatory step has a team — one person
 * gets the new Jobs, two or more share a queue. D-SET5: Shop hours is its own tab (`/admin/setup/workflow/hours`).
 */
export function AdminShopWorkflow({ messages, locale, tab = 'steps' }: { locale: AdminLocale; messages: AdminMessages; tab?: 'steps' | 'hours' }) {
  const { user } = useAuth();
  const canWrite = Boolean(user && (user.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE) || user.role === UserRole.ADMIN));
  return (
    <div className="space-y-6">
      <PageHeader title={messages.shopWorkflow} subtitle={messages.shopWorkflowTeamsDescription} />
      <nav className="flex gap-1 border-b" aria-label={messages.shopWorkflow}>
        {([
          ['steps', '/admin/setup/workflow', messages.shopWorkflowTabSteps],
          ['hours', '/admin/setup/workflow/hours', messages.shopWorkflowTabHours],
        ] as const).map(([key, href, label]) => (
          <AdminNavLink
            key={key}
            href={href}
            aria-current={tab === key ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium [@media(pointer:fine)]:min-h-9',
              tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </AdminNavLink>
        ))}
      </nav>
      {/* LTR-164 (#1): read-only only once the session says so, not while it loads. */}
      {user && !canWrite ? <p className="text-sm text-muted-foreground">{messages.shopWorkflowReadOnly}</p> : null}
      {tab === 'hours' ? <ShopHoursCard messages={messages} canWrite={canWrite} /> : <WorkflowSteps messages={messages} locale={locale} canWrite={canWrite} />}
    </div>
  );
}

type RosterPerson = { id: string; name: string; active: boolean; role: string; capabilities: AppCapability[]; openWorkOrderCount: number };

export function stepLabel(stepKey: string, messages: AdminMessages) {
  switch (stepKey) {
    case ShopWorkflowStepKey.PM: return messages.stepLabelPm;
    case ShopWorkflowStepKey.ALIGNMENT: return messages.stepLabelAlignment;
    case ShopWorkflowStepKey.DETAILING: return messages.stepLabelDetailing;
    case ShopWorkflowStepKey.QUALITY_CHECK: return messages.stepLabelQualityCheck;
    default: return stepKey;
  }
}

function teamLabel(step: ShopWorkflowStepDto, messages: AdminMessages) {
  if (step.requiredCapability === AppCapability.MECHANIC_PM) return messages.shopWorkflowTeamPm;
  if (step.requiredCapability === AppCapability.QUALITY_CHECK_PERFORM) return messages.shopWorkflowTeamSafety;
  return messages.shopWorkflowTeamStandard;
}

function sameTeam(left: string[], right: string[]) {
  return left.length === right.length && [...left].sort().join(',') === [...right].sort().join(',');
}

function WorkflowSteps({ messages, locale, canWrite }: { messages: AdminMessages; locale: AdminLocale; canWrite: boolean }) {
  const { data, error, isLoading, mutate } = useAdminWorkflowSteps();
  const { data: rosterPages } = useAdminRoster();
  const { showToast } = useActionToast();
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [adding, setAdding] = useState<ShopWorkflowStepDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDrafts(Object.fromEntries(data.map((step) => [step.stepKey, step.members.map((member) => member.id)])));
  }, [data]);

  const roster = useMemo<RosterPerson[]>(
    () => (rosterPages?.flatMap((page) => page.items) ?? []).filter((person) => person.active),
    [rosterPages],
  );
  const draftOf = (step: ShopWorkflowStepDto) => drafts[step.stepKey] ?? step.members.map((member) => member.id);
  const changed = (step: ShopWorkflowStepDto) => !sameTeam(draftOf(step), step.members.map((member) => member.id));
  const dirty = Boolean(data?.some(changed));
  useUnsavedChangesGuard(dirty, messages.unsavedChangesConfirm);

  async function save() {
    if (!data || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      // SW1: only the steps that changed.
      const next = await updateAdminWorkflowSteps(data.filter(changed).map((step) => ({ stepKey: step.stepKey, memberIds: draftOf(step) })));
      await mutate(next, { revalidate: false });
      showToast('success', messages.shopWorkflowSaved);
    } catch (failure) {
      setSaveError(apiErrorMessage(failure, messages, messages.shopWorkflowSaveFailed));
    } finally {
      setSaving(false);
    }
  }

  function eligible(step: ShopWorkflowStepDto, person: RosterPerson) {
    // Like the Job pickers, a System Admin row is not offered even when it holds a mechanic capability.
    return Boolean(step.requiredCapability && person.active && person.role !== UserRole.ADMIN && person.capabilities.includes(step.requiredCapability));
  }

  /** A draft team's chips: saved members keep the server's verdict; people added now are eligible by construction. */
  function draftMembers(step: ShopWorkflowStepDto) {
    return draftOf(step).map((id) => {
      const saved = step.members.find((member) => member.id === id);
      if (saved) return saved;
      const person = roster.find((item) => item.id === id);
      return { id, name: person?.name ?? '…', active: true, eligible: true, pendingJobCount: 0 };
    });
  }

  if (error) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;
  if (isLoading && !data) return <PageSkeleton label={messages.shopWorkflow} header={false} />;
  if (!data?.length) return <EmptyState>{messages.shopWorkflowEmpty}</EmptyState>;

  return (
    <div className={cn('space-y-4', canWrite && dirty && 'pb-24')}>
      <Card>
        <CardContent className="p-0">
          <ol className="divide-y" aria-label={messages.shopWorkflowTabSteps}>
            {data.map((step, index) => {
              const label = stepLabel(step.stepKey, messages);
              const members = draftMembers(step);
              const usable = members.filter((member) => member.eligible);
              const isQc = step.stepKey === ShopWorkflowStepKey.QUALITY_CHECK;
              return (
                // UX-4-007: three columns only from `xl`; narrower, the team goes under the step name with the full width.
                <li key={step.stepKey} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 p-4 xl:grid-cols-[2rem_minmax(0,16rem)_minmax(0,1fr)]" data-testid={`workflow-step-${step.stepKey}`}>
                  <span className="text-sm font-semibold text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">
                      {label}
                      {changed(step) ? <span className="ml-2 text-xs font-normal text-primary">{messages.shopWorkflowChanged}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fillPlaceholders(messages.shopWorkflowCatalogJob, { job: step.catalogJob.displayName, category: step.catalogJob.categoryName })}
                    </p>
                    {step.updatedBy ? (
                      <p className="text-xs text-muted-foreground">
                        {fillPlaceholders(messages.shopWorkflowChangedBy, { name: step.updatedBy.name, date: formatShortDateTime(step.updatedAt, locale) })}
                      </p>
                    ) : null}
                    {!step.catalogJob.active ? <p className="text-xs text-warning-foreground">{messages.shopWorkflowStepInactive}</p> : null}
                  </div>
                  <div className="col-start-2 min-w-0 space-y-2 xl:col-start-3">
                    <p className="text-xs font-medium text-muted-foreground">{teamLabel(step, messages)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {members.map((member) => (
                        <span
                          key={member.id}
                          className={cn(
                            // UX-4-007: one line; a long name is cut with the full name on hover.
                            'inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-2 text-sm',
                            !member.eligible && 'border-dashed text-muted-foreground',
                          )}
                          data-testid="workflow-member"
                        >
                          <MechanicAvatar id={member.id} name={member.name} size="sm" />
                          <span className={cn('min-w-0 truncate whitespace-nowrap', !member.eligible && 'line-through')} title={member.name}>{member.name}</span>
                          {!member.eligible ? (
                            <span className="text-xs">{member.active ? messages.shopWorkflowMemberWrongType : messages.shopWorkflowMemberInactive}</span>
                          ) : null}
                          {canWrite ? (
                            <button
                              type="button"
                              className="tap-inline rounded-full px-1 text-muted-foreground hover:text-foreground"
                              aria-label={fillPlaceholders(messages.shopWorkflowRemoveMember, { name: member.name, step: label })}
                              disabled={saving}
                              onClick={() => setDrafts((current) => ({ ...current, [step.stepKey]: draftOf(step).filter((id) => id !== member.id) }))}
                            >
                              <X aria-hidden="true" className="size-3.5" />
                            </button>
                          ) : null}
                        </span>
                      ))}
                      {canWrite ? (
                        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setAdding(step)}>
                          <Plus aria-hidden="true" />
                          {messages.shopWorkflowAddMember}
                        </Button>
                      ) : null}
                    </div>
                    {members.filter((member) => !member.eligible).map((member) => (
                      <p key={member.id} className="text-xs text-warning-foreground">
                        {fillPlaceholders(messages.shopWorkflowMemberIneligible, { name: member.name, step: label })}
                      </p>
                    ))}
                    {usable.length === 0 ? (
                      <p className="rounded-md border border-warning/50 bg-warning-surface px-3 py-2 text-sm text-warning-foreground" role="status">
                        {fillPlaceholders(messages.shopWorkflowEmptyTeam, { step: label })}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {isQc
                          ? messages.shopWorkflowQcQueue
                          : usable.length === 1
                            ? fillPlaceholders(messages.shopWorkflowDirect, { step: label, name: usable[0].name })
                            : fillPlaceholders(messages.shopWorkflowQueue, { step: label, count: String(usable.length) })}
                      </p>
                    )}
                    {step.stepKey === ShopWorkflowStepKey.PM ? <p className="text-xs text-muted-foreground">{messages.shopWorkflowPmScope}</p> : null}
                    {isQc ? (
                      <div className="space-y-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                        <p><span className="font-semibold">{messages.shopWorkflowQcBackupTitle}</span> {messages.shopWorkflowQcBackupBody}</p>
                        <Link className="tap-inline font-medium text-primary hover:underline" href="/qc">{messages.shopWorkflowQcBackupLink}</Link>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{messages.shopWorkflowTeamsFooter}</p>
      {saveError ? <InlineAlert>{saveError}</InlineAlert> : null}
      {/* LTR-210: "Add to team" only changes the draft; the bar stays in view until it is saved or discarded
          (same bar as Setup → Inspection checklist). */}
      {canWrite && dirty ? (
        <div data-hide-on-keyboard="" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur app-safe-bottom lg:left-[var(--admin-aside)]" data-testid="workflow-unsaved">
          <div className="mx-auto flex max-w-[1440px] items-center justify-end gap-2 px-4 py-3 md:px-6">
            <span className="mr-auto text-sm font-medium" role="status">{messages.shopWorkflowUnsaved}</span>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => { setDrafts(Object.fromEntries(data.map((step) => [step.stepKey, step.members.map((member) => member.id)]))); setSaveError(null); }}>{messages.shopWorkflowDiscard}</Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>{messages.shopWorkflowSave}</Button>
          </div>
        </div>
      ) : null}
      <AddMemberDialog
        step={adding}
        candidates={adding ? roster.filter((person) => eligible(adding, person) && !draftOf(adding).includes(person.id)) : []}
        messages={messages}
        onClose={() => setAdding(null)}
        onAdd={(ids) => {
          if (!adding) return;
          setDrafts((current) => ({ ...current, [adding.stepKey]: [...draftOf(adding), ...ids] }));
          setAdding(null);
        }}
      />
    </div>
  );
}

/** D28: pick who joins a step's team — only people who can do the step, each with their open work. */
function AddMemberDialog({
  step,
  candidates,
  messages,
  onClose,
  onAdd,
}: {
  step: ShopWorkflowStepDto | null;
  candidates: RosterPerson[];
  messages: AdminMessages;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked([]), [step?.stepKey]);
  return (
    <Modal
      open={Boolean(step)}
      title={step ? fillPlaceholders(messages.shopWorkflowAddMemberTitle, { step: stepLabel(step.stepKey, messages) }) : ''}
      onClose={onClose}
      closeLabel={messages.closeDialog}
    >
      <div className="space-y-4">
        {candidates.length ? (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
            {candidates.map((person) => (
              <li key={person.id}>
                <label className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    // UX-2-015: the checkbox is announced with the person's name, not "on".
                    aria-label={person.name}
                    checked={picked.includes(person.id)}
                    onChange={(event) => setPicked((current) => (event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id)))}
                  />
                  <MechanicAvatar id={person.id} name={person.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {adminCountLabel(person.openWorkOrderCount, messages.shopWorkflowMemberOpenWorkOne, messages.shopWorkflowMemberOpenWork)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{messages.shopWorkflowAddMemberEmpty}</p>}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose}>{messages.cancel}</Button>
          <Button type="button" disabled={!picked.length} onClick={() => onAdd(picked)}>{messages.shopWorkflowAddMemberAction}</Button>
        </DialogActions>
      </div>
    </Modal>
  );
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * LTR-186 / D20: the day close. At the cutoff on each workday the app stops every clock still running
 * (the time counts to the cutoff); mechanics tap Continue the next day. Same write gate as the steps.
 */
function ShopHoursCard({ messages, canWrite }: { messages: AdminMessages; canWrite: boolean }) {
  const { data, error, isLoading, mutate } = useAdminShopHours();
  const { showToast } = useActionToast();
  const [cutoff, setCutoff] = useState('');
  const [workdays, setWorkdays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setCutoff(data.cutoff);
    setWorkdays(data.workdays);
  }, [data]);

  const minutes = cutoffToMinutes(cutoff);
  const valid = minutes !== null && minutes >= MIN_DAY_CLOSE_MINUTES && workdays.length > 0;
  const dirty = Boolean(data && (cutoff !== data.cutoff || [...workdays].sort().join(',') !== [...data.workdays].sort().join(',')));
  useUnsavedChangesGuard(dirty, messages.unsavedChangesConfirm);

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await updateAdminShopHours({ cutoff, workdays: [...workdays].sort((left, right) => left - right) });
      await mutate(next, { revalidate: false });
      showToast('success', messages.shopHoursSaved);
    } catch (failure) {
      setSaveError(apiErrorMessage(failure, messages, messages.shopHoursSaveFailed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="shop-hours-title" data-testid="shop-hours">
      <div>
        <h2 id="shop-hours-title" className="text-lg font-semibold">{messages.shopHours}</h2>
        <p className="text-sm text-muted-foreground">{messages.shopHoursDescription}</p>
      </div>
      {saveError ? <InlineAlert>{saveError}</InlineAlert> : null}
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.shopHours} header={false} /> : null}
      {data ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            <label className="block max-w-xs space-y-1">
              <span className="text-sm font-medium">{messages.shopHoursCutoff}</span>
              <Input
                type="time"
                step={60}
                min="12:00"
                max="23:59"
                value={cutoff}
                disabled={!canWrite || saving}
                aria-invalid={cutoff !== '' && !valid}
                onChange={(event) => setCutoff(event.target.value)}
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{messages.shopHoursWorkdays}</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <label key={day} className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={workdays.includes(day)}
                      disabled={!canWrite || saving}
                      onChange={(event) => setWorkdays((current) => (
                        event.target.checked ? [...current, day] : current.filter((item) => item !== day)
                      ))}
                    />
                    {messages[`weekday${day}`]}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-muted-foreground">{messages.shopHoursOffDays}</p>
            {dirty && !valid ? <p className="text-sm text-warning-foreground" role="alert">{messages.shopHoursInvalid}</p> : null}
          </CardContent>
        </Card>
      ) : null}
      {data && canWrite ? (
        <Button type="button" className="w-full sm:w-auto" disabled={!dirty || !valid || saving} onClick={() => void save()}>{messages.shopHoursSave}</Button>
      ) : null}
    </section>
  );
}
