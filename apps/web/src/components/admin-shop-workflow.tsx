'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppCapability, UserRole, type ShopWorkflowStepDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { PageHeader, Button, Card, CardContent, EmptyState, InlineAlert, LoadFailure, PageSkeleton, Select } from './ui';
import { updateAdminWorkflowSteps, useAdminAssignableMechanics, useAdminWorkflowSteps } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { useAuth } from '@/lib/auth-context';

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
  const dirty = Boolean(data?.some((step) => (drafts[step.stepKey] ?? '') !== (step.defaultMechanic?.id ?? '')));

  async function save() {
    if (!data || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await updateAdminWorkflowSteps(data.filter((step) => step.allowsDefaultMechanic).map((step) => ({
        stepKey: step.stepKey,
        defaultMechanicId: drafts[step.stepKey] || null,
      })));
      await mutate(next, { revalidate: false });
      showToast('success', messages.shopWorkflowSaved);
    } catch {
      setSaveError(messages.shopWorkflowSaveFailed);
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
      {saveError ? <InlineAlert>{saveError}</InlineAlert> : null}
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
                    <p className="font-medium">{step.catalogJob.displayName}</p>
                    <p className="text-xs text-muted-foreground">{step.catalogJob.categoryName}</p>
                    {step.defaultMechanic && !step.defaultMechanic.active ? (
                      <p className="mt-1 text-xs text-warning-foreground">
                        {fillPlaceholders(messages.shopWorkflowInactiveOwner, { name: step.defaultMechanic.name })}
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
      {data?.length && canWrite ? (
        <Button type="button" className="w-full sm:w-auto" disabled={!dirty || saving} onClick={() => void save()}>{messages.shopWorkflowSave}</Button>
      ) : null}
    </div>
  );
}
