'use client';

import Link from 'next/link';
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
import { AdminWriteTip } from './admin-write-tip';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, InlineAlert, Input, Label, Modal } from './ui';
import { createAdminMechanic, resetAdminMechanicPassword, updateAdminMechanic } from '@/lib/admin-data';
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
    <Modal open={open} title={messages.createMechanicTitle} onClose={close} closeLabel={messages.closeDialog}>
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
          <AdminWriteTip>{messages.mechanicRosterTip}</AdminWriteTip>
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
        <AdminWriteTip>{messages.mechanicRosterTip}</AdminWriteTip>
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
}: {
  openWork: Pick<AdminMechanicOpenWorkDto, 'pendingJobs' | 'runningSession'>;
  messages: AdminMessages;
}) {
  return (
    <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm" data-testid="mechanic-open-work">
      <p className="font-semibold text-destructive-text">{messages.mechanicOpenWorkTitle}</p>
      <p className="text-destructive-text">{messages.apiError.MECHANIC_HAS_OPEN_WORK}</p>
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
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openWork, setOpenWork] = useState<Pick<AdminMechanicOpenWorkDto, 'pendingJobs' | 'runningSession'> | null>(null);
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
        {error && !deactivateOpen && !resetOpen ? <InlineAlert>{error}</InlineAlert> : null}
        <div className="flex flex-wrap gap-2">
          {mechanic.active ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDeactivateOpen(true)}>{messages.deactivateMechanic}</Button>
          ) : (
            <Button type="button" disabled={busy} onClick={() => void reactivate()}>{messages.reactivateMechanic}</Button>
          )}
          <Button type="button" variant="outline" disabled={busy} onClick={() => setResetOpen(true)}>{messages.resetPasswordAction}</Button>
        </div>
      </CardContent>

      <Modal open={deactivateOpen} title={messages.deactivateMechanicTitle} onClose={closeDeactivate} closeLabel={messages.closeDialog}>
        <div className="space-y-4">
          <p className="text-sm"><span className="font-semibold">{mechanic.name}</span> · {mechanic.email}</p>
          <p className="text-sm text-muted-foreground">{messages.deactivateMechanicConfirm}</p>
          {openWork ? <MechanicOpenWorkAlert openWork={openWork} messages={messages} /> : null}
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDeactivate} disabled={busy}>{messages.cancel}</Button>
            <Button type="button" variant="destructive" onClick={() => void deactivate()} disabled={busy || Boolean(openWork)}>{messages.deactivateMechanic}</Button>
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

function CapabilityForm({
  idPrefix,
  messages,
  initialName,
  initialCapability,
  submitLabel,
  onCancel,
  onSuccess,
  onSubmit,
}: {
  idPrefix: string;
  messages: AdminMessages;
  initialName?: string;
  initialCapability: MechanicMode;
  submitLabel: string;
  onCancel?: () => void;
  onSuccess: () => void;
  onSubmit: (mode: MechanicMode, name?: string) => Promise<unknown>;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [capability, setCapability] = useState(initialCapability);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmitForm(event: React.FormEvent) {
    event.preventDefault();
    if (initialName !== undefined && !name.trim()) {
      setError(messages.mechanicNameRequired);
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
      <MechanicCapabilityFields idPrefix={idPrefix} value={capability} messages={messages} disabled={busy} onChange={setCapability} />
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{messages.cancel}</Button> : null}
        <Button type="submit" disabled={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}
