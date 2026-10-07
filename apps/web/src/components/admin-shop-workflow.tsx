'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppCapability, MIN_DAY_CLOSE_MINUTES, UserRole, cutoffToMinutes, type ShopWorkflowStepDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { PageHeader, Button, Card, CardContent, EmptyState, InlineAlert, Input, LoadFailure, PageSkeleton, Select } from './ui';
import { updateAdminShopHours, updateAdminWorkflowSteps, useAdminAssignableMechanics, useAdminShopHours, useAdminWorkflowSteps } from '@/lib/admin-data';
import { apiErrorMessage } from '@/lib/api-error-message';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { useAuth } from '@/lib/auth-context';
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes-guard';

/**
 * LTR-157 / D15, D16: Admin → Setup → Shop workflow. Step → catalog Job →
 * default owner. Quality Check has no owner (the Manager completes it).
 */
export function AdminShopWorkflow({ messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const { user } = useAuth();
  const canWrite = Boolean(user && (user.capabilities.includes(AppCapability.WORK_ORDERS_MANAGE) || user.role === UserRole.ADMIN));
  const { data, error, isLoading, mutate } = useAdminWorkflowSteps();
  const { data: mechanicPages } = useAdminAssignableMechanics();
  const { showToast } = useActionToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDrafts(Object.fromEntries(data.map((step) => [step.stepKey, step.defaultMechanic?.id ?? ''])));
  }, [data]);

  const mechanics = useMemo(
    () => (mechanicPages?.flatMap((page) => page.items) ?? []).filter((mechanic) => mechanic.active),
    [mechanicPages],
  );
  const changed = (step: ShopWorkflowStepDto) => (drafts[step.stepKey] ?? '') !== (step.defaultMechanic?.id ?? '');
  const dirty = Boolean(data?.some(changed));
  useUnsavedChangesGuard(dirty, messages.unsavedChangesConfirm);

  async function save() {
    if (!data || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      // SW1: only the steps that changed, so an owner who left another step does not block this save.
      const next = await updateAdminWorkflowSteps(data.filter((step) => step.allowsDefaultMechanic && changed(step)).map((step) => ({
        stepKey: step.stepKey,
        defaultMechanicId: drafts[step.stepKey] || null,
      })));
      await mutate(next, { revalidate: false });
      showToast('success', messages.shopWorkflowSaved);
    } catch (failure) {
      setSaveError(apiErrorMessage(failure, messages, messages.shopWorkflowSaveFailed));
    } finally {
      setSaving(false);
    }
  }

  function ownerOptions(step: ShopWorkflowStepDto) {
    const eligible = mechanics.filter((mechanic) => step.requiredCapability && mechanic.capabilities.includes(step.requiredCapability));
    // Keep the saved owner visible even when they are no longer eligible (inactive, capability removed).
    if (step.defaultMechanic && !eligible.some((mechanic) => mechanic.id === step.defaultMechanic?.id)) {
      return [{ id: step.defaultMechanic.id, name: step.defaultMechanic.name }, ...eligible];
    }
    return eligible;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={messages.shopWorkflow}
        subtitle={messages.shopWorkflowDescription}
      />
      {/* LTR-164 (#1): read-only only once the session says so, not while it loads. */}
      {user && !canWrite ? <p className="text-sm text-muted-foreground">{messages.shopWorkflowReadOnly}</p> : null}
      {error ? <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} /> : null}
      {isLoading && !data ? <PageSkeleton label={messages.shopWorkflow} header={false} /> : null}
      {data && data.length === 0 ? <EmptyState>{messages.shopWorkflowEmpty}</EmptyState> : null}
      {data?.length ? (
        <Card>
          <CardContent className="p-0">
            <ol className="divide-y" aria-label={messages.shopWorkflow}>
              {data.map((step, index) => (
                <li key={step.stepKey} className="grid gap-2 p-4 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,16rem)] sm:items-center">
                  <span className="text-sm font-semibold text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {step.catalogJob.displayName}
                      {changed(step) ? <span className="ml-2 text-xs font-normal text-primary">{messages.shopWorkflowChanged}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.catalogJob.categoryName}</p>
                    {!step.catalogJob.active ? (
                      <p className="mt-1 text-xs text-warning-foreground">{messages.shopWorkflowStepInactive}</p>
                    ) : null}
                    {step.defaultMechanic && !changed(step) && !step.defaultMechanic.eligible ? (
                      <p className="mt-1 text-xs text-warning-foreground">
                        {fillPlaceholders(
                          step.defaultMechanic.active ? messages.shopWorkflowIneligibleOwner : messages.shopWorkflowInactiveOwner,
                          { name: step.defaultMechanic.name },
                        )}
                      </p>
                    ) : null}
                  </div>
                  {step.allowsDefaultMechanic ? (
                    <Select
                      aria-label={fillPlaceholders(messages.shopWorkflowOwnerFor, { step: step.catalogJob.displayName })}
                      value={drafts[step.stepKey] ?? ''}
                      disabled={!canWrite || saving}
                      onChange={(event) => setDrafts((current) => ({ ...current, [step.stepKey]: event.target.value }))}
                    >
                      <option value="">{messages.shopWorkflowNoOwner}</option>
                      {ownerOptions(step).map((mechanic) => (
                        <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">{messages.shopWorkflowQcOwner}</p>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
      {saveError ? <InlineAlert>{saveError}</InlineAlert> : null}
      {data?.length && canWrite ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" className="w-full sm:w-auto" disabled={!dirty || saving} onClick={() => void save()}>{messages.shopWorkflowSave}</Button>
          {dirty ? <p className="text-sm text-muted-foreground" role="status">{messages.shopWorkflowUnsaved}</p> : null}
        </div>
      ) : null}
      <ShopHoursCard messages={messages} canWrite={canWrite} />
    </div>
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
