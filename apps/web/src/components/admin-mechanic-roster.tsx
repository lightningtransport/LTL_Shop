'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AppCapability,
  MechanicMode,
  UserRole,
  type AdminMechanicDetailDto,
  type AdminMechanicOpenWorkDto,
  type AdminMechanicSummaryDto,
} from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DialogActions, InlineAlert, Input, Label, Modal } from './ui';
import { createAdminMechanic, deleteAdminMechanic, removeAdminMechanic, resetAdminMechanicPassword, sendAdminMechanicJobsToQueue, updateAdminMechanic } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { adminWriteFailureMessage, isRosterEmail, mechanicOpenWorkFromError } from '@/lib/system-admin';

const rosterCopy = (messages: AdminMessages) => ({
  locale: messages.locale,
  apiError: messages.apiError,
  forbidden: messages.mechanicWriteForbidden,
  conflict: messages.mechanicWriteConflict,
  failed: messages.mechanicWriteFailed,
});

/** D22: one type per person; Safety is `quality_check.perform`. */
export function currentMode(capabilities: AppCapability[]): MechanicMode {
  if (capabilities.includes(AppCapability.QUALITY_CHECK_PERFORM) && !capabilities.includes(AppCapability.MECHANIC_STANDARD)) {
    return MechanicMode.SAFETY;
  }
  return capabilities.includes(AppCapability.MECHANIC_PM) && !capabilities.includes(AppCapability.MECHANIC_STANDARD)
    ? MechanicMode.PM
    : MechanicMode.STANDARD;
}

export function MechanicCapabilityFields({
  idPrefix,
  value,
  messages,
  disabled,
  onChange,
}: {
  idPrefix: string;
  value: MechanicMode;
  messages: AdminMessages;
  disabled?: boolean;
  onChange: (value: MechanicMode) => void;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">{messages.mechanicCapability}</legend>
      {[
        { id: `${idPrefix}-standard`, value: MechanicMode.STANDARD, label: messages.mechanicStandard },
        { id: `${idPrefix}-pm`, value: MechanicMode.PM, label: messages.mechanicPm },
        { id: `${idPrefix}-safety`, value: MechanicMode.SAFETY, label: messages.capabilitySafety },
      ].map((option) => (
        <label key={option.id} htmlFor={option.id} className="flex min-h-11 items-center gap-3 text-sm">
          <input
            id={option.id}
            type="radio"
            name={`${idPrefix}-capability`}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * D22: the temporary password, shown once. Read-only field plus Copy; null means this environment
 * has no Supabase service key (local dev), so no access account exists yet.
 */
export function TemporaryPasswordPanel({
  password,
  messages,
  idPrefix,
}: {
  password: string | null;
  messages: AdminMessages;
  idPrefix: string;
}) {
  const [copied, setCopied] = useState(false);
  if (password === null) {
    return <p role="status" className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">{messages.temporaryPasswordNone}</p>;
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(password!);
      setCopied(true);
    } catch {
      const field = document.getElementById(`${idPrefix}-temporary-password`) as HTMLInputElement | null;
      field?.select();
      setCopied(false);
    }
  }
  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3" data-testid="temporary-password-panel">
      <Label htmlFor={`${idPrefix}-temporary-password`}>{messages.temporaryPasswordTitle}</Label>
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-temporary-password`}
          value={password}
          readOnly
          className="font-mono text-base tracking-wider"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" variant="outline" onClick={() => void copy()}>{copied ? messages.passwordCopied : messages.copyPassword}</Button>
      </div>
      <p className="text-sm text-muted-foreground">{messages.temporaryPasswordHint}</p>
    </div>
  );
}

export function CreateMechanicDialog({
  open,
  messages,
  onClose,
  onCreated,
}: {
  open: boolean;
  messages: AdminMessages;
  onClose: () => void;
  /** Called once the person exists (the dialog stays open on the password step until Done). */
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [capability, setCapability] = useState<MechanicMode>(MechanicMode.STANDARD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ name: string; email: string; temporaryPassword: string | null } | null>(null);

  function reset() {
    setName('');
    setEmail('');
    setCapability(MechanicMode.STANDARD);
    setError(null);
    setResult(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError(messages.mechanicNameRequired);
      return;
    }
    if (!isRosterEmail(email)) {
      setError(messages.mechanicEmailRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createAdminMechanic({ name, email, mode: capability });
      setResult({ name: created.name, email: created.email, temporaryPassword: created.temporaryPassword });
      onCreated();
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, rosterCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={messages.createMechanicTitle}
      onClose={close}
      closeLabel={messages.closeDialog}
      dismissible={!result && !name.trim() && !email.trim()}
    >
      {result ? (
        <div className="space-y-4">
          <p className="text-sm"><span className="font-semibold">{result.name}</span> · {result.email}</p>
          <TemporaryPasswordPanel password={result.temporaryPassword} messages={messages} idPrefix="create-mechanic" />
          <div className="flex justify-end">
            <Button type="button" onClick={close}>{messages.doneAction}</Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="create-mechanic-name">{messages.mechanicName}</Label>
            <Input id="create-mechanic-name" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-mechanic-email">{messages.mechanicEmail}</Label>
            <Input id="create-mechanic-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} autoComplete="off" />
          </div>
          <MechanicCapabilityFields idPrefix="create-mechanic" value={capability} messages={messages} disabled={busy} onChange={setCapability} />
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={busy}>{messages.cancel}</Button>
            <Button type="submit" disabled={busy}>{messages.createMechanic}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function ActivateMechanicDialog({
  mechanic,
  messages,
  onClose,
  onActivated,
}: {
  mechanic: AdminMechanicSummaryDto | null;
  messages: AdminMessages;
  onClose: () => void;
  onActivated: () => void;
}) {
  return (
    <Modal open={Boolean(mechanic)} title={messages.activateMechanicTitle} onClose={onClose} closeLabel={messages.closeDialog}>
      {mechanic ? (
        <>
        <CapabilityForm
          key={mechanic.id}
          idPrefix={`activate-${mechanic.id}`}
          messages={messages}
          initialCapability={currentMode(mechanic.capabilities)}
          submitLabel={messages.activateMechanic}
          onCancel={onClose}
          onSuccess={onActivated}
          onSubmit={(mode) => updateAdminMechanic(mechanic.id, { active: true, mode })}
        />
        </>
      ) : null}
    </Modal>
  );
}

export function MechanicCapabilityEditor({
  mechanic,
  messages,
  onSaved,
}: {
  mechanic: AdminMechanicDetailDto;
  messages: AdminMessages;
  onSaved: () => void;
}) {
  const { showToast } = useActionToast();
  if (mechanic.role !== UserRole.MECHANIC) return null;
  const savedMessage = mechanic.active ? messages.mechanicSaved : messages.mechanicActivated;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.mechanicCapabilityTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <CapabilityForm
          idPrefix={`mechanic-${mechanic.id}`}
          messages={messages}
          initialName={mechanic.name}
          initialCapability={currentMode(mechanic.capabilities)}
          submitLabel={mechanic.active ? messages.saveMechanic : messages.activateMechanic}
          typeChangeWarning={typeChangeWarning(mechanic, messages)}
          onSuccess={() => {
            showToast('success', savedMessage);
            onSaved();
          }}
          onSubmit={(mode, name) => updateAdminMechanic(mechanic.id, {
            name,
            mode,
            ...(mechanic.active ? {} : { active: true }),
          })}
        />
      </CardContent>
    </Card>
  );
}

/** D22: what blocks a deactivation — each pending Job links to its Work Order so the Manager reassigns it. */
export function MechanicOpenWorkAlert({
  openWork,
  messages,
  listOnly = false,
}: {
  openWork: Pick<AdminMechanicOpenWorkDto, 'pendingJobs' | 'runningSession'>;
  messages: AdminMessages;
  /** LTR-199: inside another notice (Remove from Shop), only the list. */
  listOnly?: boolean;
}) {
  return (
    <div role="alert" className={listOnly ? 'space-y-2 text-sm' : 'space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm'} data-testid="mechanic-open-work">
      {listOnly ? null : <p className="font-semibold text-destructive-text">{messages.mechanicOpenWorkTitle}</p>}
      {listOnly ? null : <p className="text-destructive-text">{messages.apiError.MECHANIC_HAS_OPEN_WORK}</p>}
      {openWork.pendingJobs.length ? (
        <ul className="space-y-1">
          {openWork.pendingJobs.map((job, index) => (
            <li key={`${job.workOrderId}-${job.jobDisplayName}-${index}`}>
              <Link className="tap-inline font-medium text-primary hover:underline" href={`/admin/work-orders/${job.workOrderId}`}>
                {job.workOrderDisplayId} · {job.truckNumber}
              </Link>
              {' · '}
              <span className="text-foreground">{job.jobDisplayName}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {openWork.runningSession ? <p className="text-destructive-text">{messages.mechanicOpenWorkRunning}</p> : null}
    </div>
  );
}

/**
 * D22: the person's access — deactivate (refused with open work), reactivate, and a new temporary
 * password shown once. Lives on the detail page next to name and type.
 */
export function MechanicAccessCard({
  mechanic,
  messages,
  onChanged,
}: {
  mechanic: AdminMechanicDetailDto;
  messages: AdminMessages;
  onChanged: () => void;
}) {
  const { showToast } = useActionToast();
  const router = useRouter();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openWork, setOpenWork] = useState<Pick<AdminMechanicOpenWorkDto, 'pendingJobs' | 'runningSession'> | null>(null);
  // ME2: what blocks deactivating is known when the dialog opens, not after confirming.
  const knownOpenWork = mechanic.pendingJobs.length || mechanic.runningSession
    ? { pendingJobs: mechanic.pendingJobs, runningSession: mechanic.runningSession }
    : null;
  const blockingWork = openWork ?? knownOpenWork;
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  if (mechanic.role !== UserRole.MECHANIC) return null;

  function closeDeactivate() {
    setDeactivateOpen(false);
    setError(null);
    setOpenWork(null);
  }

  function closeReset() {
    setResetOpen(false);
    setError(null);
    setResetPassword(null);
  }

  async function deactivate() {
    setBusy(true);
    setError(null);
    setOpenWork(null);
    try {
      await updateAdminMechanic(mechanic.id, { active: false });
      showToast('success', messages.mechanicDeactivated);
      closeDeactivate();
      onChanged();
    } catch (failure) {
      const blocked = mechanicOpenWorkFromError(failure);
      if (blocked) setOpenWork(blocked);
      else setError(adminWriteFailureMessage(failure, rosterCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  // LTR-199 / D31: Remove from Shop — the block is known when the dialog opens; queue Jobs can go back from here.
  const queueJobs = mechanic.pendingJobs.filter((job) => job.workflowStepKey);
  async function sendQueueJobs() {
    setBusy(true);
    setError(null);
    try {
      const result = await sendAdminMechanicJobsToQueue(mechanic.id);
      showToast('success', [
        fillPlaceholders(messages.peopleSentToQueue, { count: String(result.sent) }),
        result.skipped ? fillPlaceholders(messages.peopleSendSkipped, { count: String(result.skipped) }) : '',
      ].filter(Boolean).join(' '));
      onChanged();
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, rosterCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  async function removeOrDelete(kind: 'remove' | 'delete') {
    setBusy(true);
    setError(null);
    try {
      if (kind === 'remove') await removeAdminMechanic(mechanic.id);
      else await deleteAdminMechanic(mechanic.id);
      showToast('success', kind === 'remove' ? messages.peopleRemoved : messages.peopleDeleted);
      setRemoveOpen(false);
      if (kind === 'delete') router.push('/admin/mechanics');
      else onChanged();
    } catch (failure) {
      const blocked = mechanicOpenWorkFromError(failure);
      if (blocked) onChanged();
      else setError(adminWriteFailureMessage(failure, rosterCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  async function reactivate() {
    setBusy(true);
    setError(null);
    try {
      await updateAdminMechanic(mechanic.id, { active: true });
      showToast('success', messages.mechanicReactivated);
      onChanged();
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, rosterCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      const result = await resetAdminMechanicPassword(mechanic.id);
      setResetPassword(result.temporaryPassword);
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, rosterCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.accessTitle}</CardTitle>
        <CardDescription>{mechanic.active ? messages.accessActiveHint : messages.accessInactiveHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && !deactivateOpen && !resetOpen && !removeOpen ? <InlineAlert>{error}</InlineAlert> : null}
        <ul className="divide-y rounded-lg border">
          <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">{messages.peopleResetHint}</p>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setResetOpen(true)}>{messages.resetPasswordAction}</Button>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">{messages.peopleDeactivateHint}</p>
            {mechanic.active ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => setDeactivateOpen(true)}>{messages.deactivateMechanic}</Button>
            ) : (
              <Button type="button" disabled={busy} onClick={() => void reactivate()}>{messages.reactivateMechanic}</Button>
            )}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">{messages.peopleRemoveHint}</p>
            <Button type="button" variant="outline" className="text-destructive-text" disabled={busy} onClick={() => { setError(null); setRemoveOpen(true); }}>{messages.peopleRemove}</Button>
          </li>
        </ul>
      </CardContent>

      <Modal open={removeOpen} title={fillPlaceholders(messages.peopleRemoveTitle, { name: mechanic.name })} onClose={() => setRemoveOpen(false)} closeLabel={messages.closeDialog}>
        <div className="space-y-4" data-testid="remove-person-dialog">
          <p className="text-sm text-muted-foreground">{fillPlaceholders(messages.peopleRemoveBody, { name: mechanic.name })}</p>
          {knownOpenWork ? (
            <div className="space-y-2 rounded-xl border border-warning/40 bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
              <p className="font-semibold">{fillPlaceholders(messages.peopleMoveFirst, { count: String(mechanic.pendingJobs.length) })}</p>
              {queueJobs.length ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void sendQueueJobs()}>
                  {fillPlaceholders(messages.peopleSendAllToQueue, { count: String(queueJobs.length) })}
                </Button>
              ) : null}
              <MechanicOpenWorkAlert openWork={knownOpenWork} messages={messages} listOnly />
            </div>
          ) : (
            <p className="text-sm text-success">{messages.peopleReadyToRemove}</p>
          )}
          {mechanic.defaultOwnerOfSteps.map((step) => {
            const left = Math.max((step.memberCount ?? 1) - 1, 0);
            return (
              <p key={step.stepKey} className="text-sm text-muted-foreground">
                {left
                  ? fillPlaceholders(messages.peopleLeavesTeam, { step: step.jobDisplayName, count: String(left) })
                  : fillPlaceholders(messages.peopleLeavesTeamEmpty, { step: step.jobDisplayName })}
              </p>
            );
          })}
          {mechanic.canDelete ? <p className="text-sm">{messages.peopleDeleteOffer}</p> : null}
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={() => setRemoveOpen(false)} disabled={busy}>{messages.cancel}</Button>
            {mechanic.canDelete ? (
              <Button type="button" variant="outline" className="text-destructive-text" disabled={busy || Boolean(knownOpenWork)} onClick={() => void removeOrDelete('delete')}>{messages.peopleDelete}</Button>
            ) : null}
            <Button type="button" variant="destructive" disabled={busy || Boolean(knownOpenWork)} onClick={() => void removeOrDelete('remove')}>{messages.peopleRemove}</Button>
          </DialogActions>
        </div>
      </Modal>

      <Modal open={deactivateOpen} title={messages.deactivateMechanicTitle} onClose={closeDeactivate} closeLabel={messages.closeDialog}>
        <div className="space-y-4">
          <p className="text-sm"><span className="font-semibold">{mechanic.name}</span> · {mechanic.email}</p>
          <p className="text-sm text-muted-foreground">{messages.deactivateMechanicConfirm}</p>
          {blockingWork ? <MechanicOpenWorkAlert openWork={blockingWork} messages={messages} /> : null}
          {mechanic.defaultOwnerOfSteps.length ? (
            <p className="text-sm text-warning-foreground">
              {fillPlaceholders(messages.mechanicOwnsStepsWarning, {
                name: mechanic.name,
                steps: mechanic.defaultOwnerOfSteps.map((step) => step.jobDisplayName).join(', '),
              })}
            </p>
          ) : null}
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDeactivate} disabled={busy}>{messages.cancel}</Button>
            <Button type="button" variant="destructive" onClick={() => void deactivate()} disabled={busy || Boolean(blockingWork)}>{messages.deactivateMechanic}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={resetOpen} title={messages.resetPasswordTitle} onClose={closeReset} closeLabel={messages.closeDialog}>
        {resetPassword !== null ? (
          <div className="space-y-4">
            <p className="text-sm"><span className="font-semibold">{mechanic.name}</span> · {mechanic.email}</p>
            <TemporaryPasswordPanel password={resetPassword} messages={messages} idPrefix={`reset-${mechanic.id}`} />
            <div className="flex justify-end">
              <Button type="button" onClick={closeReset}>{messages.doneAction}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm"><span className="font-semibold">{mechanic.name}</span> · {mechanic.email}</p>
            <p className="text-sm text-muted-foreground">{messages.resetPasswordConfirm}</p>
            {error ? <InlineAlert>{error}</InlineAlert> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeReset} disabled={busy}>{messages.cancel}</Button>
              <Button type="button" onClick={() => void reset()} disabled={busy}>{messages.resetPasswordAction}</Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

/** SW3: what changing this person's type leaves behind — steps they own by default and Jobs still in their name. */
/**
 * SW3, LTR-199 / D-SET2, D-SET3: what changing this person's type does. With Jobs still pending it is blocked
 * (they move first, like deactivating); otherwise it takes them off the step teams of their old type.
 */
function typeChangeWarning(mechanic: AdminMechanicDetailDto, messages: AdminMessages): TypeChangeWarning {
  const pending = mechanic.pendingJobs.length;
  if (pending || mechanic.runningSession) {
    const type = mechanicTypeName(currentMode(mechanic.capabilities), messages);
    return { blocked: true, lines: [fillPlaceholders(messages.peopleTypeBlocked, { count: String(pending), type })] };
  }
  if (mechanic.defaultOwnerOfSteps.length) {
    return {
      blocked: false,
      lines: [fillPlaceholders(messages.peopleTypeLeavesTeams, { name: mechanic.name, steps: mechanic.defaultOwnerOfSteps.map((step) => step.jobDisplayName).join(', ') })],
    };
  }
  return { blocked: false, lines: [] };
}

type TypeChangeWarning = { blocked: boolean; lines: string[] };

function mechanicTypeName(mode: MechanicMode, messages: AdminMessages) {
  return mode === MechanicMode.PM ? messages.mechanicPm : mode === MechanicMode.SAFETY ? messages.capabilitySafety : messages.mechanicStandard;
}

function CapabilityForm({
  idPrefix,
  messages,
  initialName,
  initialCapability,
  submitLabel,
  typeChangeWarning = { blocked: false, lines: [] },
  onCancel,
  onSuccess,
  onSubmit,
}: {
  idPrefix: string;
  messages: AdminMessages;
  initialName?: string;
  initialCapability: MechanicMode;
  submitLabel: string;
  /** SW3 / D-SET3: shown when the type changes. Blocked: Save stays off. Otherwise the first Save only shows it. */
  typeChangeWarning?: TypeChangeWarning;
  onCancel?: () => void;
  onSuccess: () => void;
  onSubmit: (mode: MechanicMode, name?: string) => Promise<unknown>;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [capability, setCapability] = useState(initialCapability);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warned, setWarned] = useState(false);
  const typeChanged = capability !== initialCapability;
  const warnings = typeChanged ? typeChangeWarning.lines : [];
  const blocked = typeChanged && typeChangeWarning.blocked;

  async function onSubmitForm(event: React.FormEvent) {
    event.preventDefault();
    if (initialName !== undefined && !name.trim()) {
      setError(messages.mechanicNameRequired);
      return;
    }
    if (warnings.length && !warned) {
      setWarned(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(capability, initialName === undefined ? undefined : name.trim());
      onSuccess();
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, rosterCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void onSubmitForm(event)}>
      {initialName === undefined ? null : (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-name`}>{messages.mechanicName}</Label>
          <Input id={`${idPrefix}-name`} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} autoComplete="off" />
        </div>
      )}
      <MechanicCapabilityFields
        idPrefix={idPrefix}
        value={capability}
        messages={messages}
        disabled={busy}
        onChange={(next) => {
          setCapability(next);
          setWarned(false);
        }}
      />
      {warnings.length ? (
        <div role="status" className="space-y-1 rounded-xl border border-warning/40 bg-warning-surface px-3 py-2 text-sm text-warning-foreground" data-testid="mechanic-type-warning">
          {warnings.map((line) => <p key={line}>{line}</p>)}
        </div>
      ) : null}
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{messages.cancel}</Button> : null}
        <Button type="submit" disabled={busy || blocked}>{warnings.length && warned && !blocked ? messages.mechanicTypeChangeConfirm : submitLabel}</Button>
      </div>
    </form>
  );
}
