'use client';

import { useState } from 'react';
import { AppCapability, MechanicMode, UserRole, type AdminMechanicDetailDto, type AdminMechanicSummaryDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminWriteTip } from './admin-write-tip';
import { Button, Card, CardContent, CardHeader, CardTitle, InlineAlert, Input, Label, Modal } from './ui';
import { createAdminMechanic, updateAdminMechanic } from '@/lib/admin-data';
import type { AdminMessages } from '@/lib/admin-messages';
import { adminWriteFailureMessage, isRosterEmail } from '@/lib/system-admin';

const rosterCopy = (messages: AdminMessages) => ({
  forbidden: messages.mechanicWriteForbidden,
  conflict: messages.mechanicWriteConflict,
  failed: messages.mechanicWriteFailed,
});

function currentMode(capabilities: AppCapability[]): MechanicMode {
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

export function CreateMechanicDialog({
  open,
  messages,
  onClose,
  onCreated,
}: {
  open: boolean;
  messages: AdminMessages;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [capability, setCapability] = useState<MechanicMode>(MechanicMode.STANDARD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      await createAdminMechanic({ name, email, mode: capability });
      setName('');
      setEmail('');
      setCapability(MechanicMode.STANDARD);
      onCreated();
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, rosterCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={messages.createMechanicTitle} onClose={onClose} closeLabel={messages.closeDialog}>
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
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={busy}>{messages.createMechanic}</Button>
        </div>
      </form>
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
