'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Link2, Search } from 'lucide-react';
import {
  truckYearRange,
  type AdminTruckAdminDto,
  type AdminTruckOpenWorkOrderConflictDto,
  type SamsaraCandidateDto,
  type SamsaraConnectField,
  type TruckDto,
} from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { MissingSummary, RequiredNote, focusField, type MissingField } from './parts-costs-form-ui';
import { Badge, Button, CardListSkeleton, DialogActions, InlineAlert, Input, Label, Modal } from './ui';
import { ApiError } from '@/lib/api';
import { apiErrorCode } from '@/lib/api-error-message';
import {
  connectAdminTruckSamsara,
  createAdminTruck,
  deleteAdminTruck,
  disconnectAdminTruckSamsara,
  updateAdminTruck,
  useAdminTruckSamsaraCandidates,
} from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { needsComparison, samsaraFieldRows, type SamsaraFieldRow } from '@/lib/samsara-connect';
import { adminWriteFailureMessage } from '@/lib/system-admin';
import { cn } from '@/lib/utils';
import { draftKeys, readDraftJson, writeDraftJson } from '@/lib/local-draft';

export const truckCopy = (messages: AdminMessages) => ({
  locale: messages.locale,
  apiError: messages.apiError,
  forbidden: messages.truckWriteForbidden,
  conflict: messages.truckWriteConflict,
  failed: messages.truckWriteFailed,
});

type TextField = 'truckNumber' | 'vin' | 'make' | 'model' | 'year' | 'licensePlate' | 'owner' | 'company' | 'dispatcher' | 'insurance';

const FORM_FIELDS: Array<{ key: TextField; label: keyof AdminMessages; wide?: boolean }> = [
  { key: 'truckNumber', label: 'truckFieldNumber' },
  { key: 'vin', label: 'truckFieldVin' },
  { key: 'make', label: 'truckFieldMake' },
  { key: 'model', label: 'truckFieldModel' },
  { key: 'year', label: 'truckFieldYear' },
  { key: 'licensePlate', label: 'truckFieldPlate' },
  { key: 'owner', label: 'truckFieldOwner' },
  { key: 'company', label: 'truckFieldCompany' },
  { key: 'dispatcher', label: 'truckFieldDispatcher' },
  { key: 'insurance', label: 'truckFieldInsurance' },
];

const FIELD_LABEL: Record<SamsaraConnectField, keyof AdminMessages> = {
  vin: 'truckFieldVin',
  make: 'truckFieldMake',
  model: 'truckFieldModel',
  year: 'truckFieldYear',
  licensePlate: 'truckFieldPlate',
};

function formFrom(truck: TruckDto | null): Record<TextField, string> {
  return {
    truckNumber: truck?.truckNumber ?? '',
    vin: truck?.vin ?? '',
    make: truck?.make ?? '',
    model: truck?.model ?? '',
    year: truck?.year == null ? '' : String(truck.year),
    licensePlate: truck?.licensePlate ?? '',
    owner: truck?.owner ?? '',
    company: truck?.company ?? '',
    dispatcher: truck?.dispatcher ?? '',
    insurance: truck?.insurance ?? '',
  };
}

/**
 * D44 / HU-M18: Add truck and Edit truck, one form (like Add person, D22). Only the number is required; empty fields
 * are "not known". Mileage is not here: the official one is confirmed at PM (D10). A VIN on another truck links to it.
 */
export function TruckFormDialog({
  open,
  truck = null,
  messages,
  onClose,
  onSaved,
}: {
  open: boolean;
  truck?: TruckDto | null;
  messages: AdminMessages;
  onClose: () => void;
  onSaved: (truck: TruckDto) => void;
}) {
  // LTR-293 §2: what was typed stays on this device; reopening the form after a reload or Back brings it back.
  const draftKey = draftKeys.truckForm(truck?.id ?? null);
  const [form, setForm] = useState(() => formFrom(truck));
  const [error, setError] = useState<string | null>(null);
  const [vinOwner, setVinOwner] = useState<{ id: string; truckNumber: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // LTR-293 §4: a missing number or a bad year is said under that field (not in one alert at the bottom), and Save
  // goes to the first one. Server errors (VIN on another truck, write failed) stay in the alert.
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...formFrom(truck), ...(readDraftJson<Partial<ReturnType<typeof formFrom>>>(draftKey) ?? {}) });
      setError(null);
      setVinOwner(null);
      setShowErrors(false);
    }
  }, [open, truck, draftKey]);

  const range = truckYearRange();
  const yearValue = form.year.trim() ? Number(form.year) : null;
  const fieldErrors: Partial<Record<TextField, string>> = {
    ...(!form.truckNumber.trim() ? { truckNumber: messages.truckNumberRequired } : {}),
    ...(yearValue !== null && (!Number.isInteger(yearValue) || yearValue < range.min || yearValue > range.max)
      ? { year: fillPlaceholders(messages.truckYearInvalid, { min: String(range.min), max: String(range.max) }) }
      : {}),
  };
  const missing: MissingField[] = FORM_FIELDS
    .filter(({ key }) => fieldErrors[key])
    .map(({ key, label }) => ({ label: String(messages[label]), fieldId: `truck-form-${key}` }));

  const dirty = JSON.stringify(form) !== JSON.stringify(formFrom(truck));

  useEffect(() => {
    if (open) writeDraftJson(draftKey, dirty ? form : null);
  }, [open, draftKey, dirty, form]);

  // Cancel discards on purpose; Save sends it.
  const discard = () => {
    writeDraftJson(draftKey, null);
    onClose();
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (missing.length) {
      setShowErrors(true);
      setError(null);
      setVinOwner(null);
      focusField(missing[0].fieldId);
      return;
    }
    const year = yearValue;
    setBusy(true);
    setError(null);
    setVinOwner(null);
    const input = {
      truckNumber: form.truckNumber.trim(),
      vin: form.vin, make: form.make, model: form.model, year,
      licensePlate: form.licensePlate, owner: form.owner, company: form.company, dispatcher: form.dispatcher, insurance: form.insurance,
    };
    try {
      const saved = truck ? await updateAdminTruck(truck.id, input) : await createAdminTruck(input);
      writeDraftJson(draftKey, null);
      onSaved(saved);
    } catch (failure) {
      const other = failure instanceof ApiError && apiErrorCode(failure) === 'TRUCK_VIN_TAKEN'
        ? (failure.body as { truck?: { id: string; truckNumber: string } }).truck ?? null
        : null;
      if (other) {
        setVinOwner(other);
        setError(fillPlaceholders(messages.truckVinTakenBy, { truck: other.truckNumber }));
      } else {
        setError(adminWriteFailureMessage(failure, truckCopy(messages)));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={truck ? fillPlaceholders(messages.truckEditTitle, { truck: truck.truckNumber }) : messages.truckAdd}
      description={messages.truckFormHint}
      onClose={onClose}
      closeLabel={messages.closeDialog}
      dismissible={!dirty}
    >
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)} data-testid="truck-form" noValidate>
        {showErrors && missing.length > 1 ? <MissingSummary missing={missing} messages={messages} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {FORM_FIELDS.map(({ key, label }) => {
            const fieldError = showErrors ? fieldErrors[key] : undefined;
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`truck-form-${key}`}>{String(messages[label])}</Label>
                <Input
                  id={`truck-form-${key}`}
                  value={form[key]}
                  inputMode={key === 'year' ? 'numeric' : undefined}
                  className={key === 'vin' ? 'font-mono uppercase' : undefined}
                  autoComplete="off"
                  disabled={busy}
                  required={key === 'truckNumber'}
                  aria-invalid={fieldError ? true : undefined}
                  aria-describedby={fieldError ? `truck-form-${key}-error` : undefined}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                />
                <RequiredNote show={Boolean(fieldError)} id={`truck-form-${key}-error`} messages={messages} text={fieldError} />
              </div>
            );
          })}
        </div>
        {error ? (
          <InlineAlert>
            {error}
            {vinOwner ? <> <Link className="font-medium underline" href={`/admin/trucks/${vinOwner.id}`}>{fillPlaceholders(messages.truckOpenOther, { truck: vinOwner.truckNumber })}</Link></> : null}
          </InlineAlert>
        ) : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={discard} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={busy}>{truck ? messages.truckSave : messages.truckAdd}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}

// LTR-235: disconnecting Samsara lives in the "…" with the other truck-card actions, not as a button on top.
export type TruckAdminDialog = 'edit' | 'deactivate' | 'delete' | 'disconnect-samsara' | null;

/** D44: Edit, Deactivate / Reactivate and Delete from the truck's "…" (confirmations like People, D31). */
export function TruckAdminDialogs({
  truck,
  admin,
  dialog,
  knownOpenWorkOrder = null,
  messages,
  onClose,
  onChanged,
  onDeleted,
}: {
  truck: TruckDto;
  admin: AdminTruckAdminDto | undefined;
  dialog: TruckAdminDialog;
  /** The open Work Order the page already knows: the blocker shows before confirming (like People, ME2). */
  knownOpenWorkOrder?: { id: string; displayId: string } | null;
  messages: AdminMessages;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { showToast } = useActionToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusedBy, setOpenWorkOrder] = useState<AdminTruckOpenWorkOrderConflictDto['workOrder'] | null>(null);
  const openWorkOrder = refusedBy ?? knownOpenWorkOrder;

  useEffect(() => {
    setError(null);
    setOpenWorkOrder(null);
  }, [dialog]);

  async function run(action: () => Promise<unknown>, done: string, after: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      showToast('success', done);
      onClose();
      after();
    } catch (failure) {
      if (failure instanceof ApiError && apiErrorCode(failure) === 'TRUCK_HAS_OPEN_WORK_ORDER') {
        setOpenWorkOrder((failure.body as AdminTruckOpenWorkOrderConflictDto).workOrder);
      } else {
        setError(adminWriteFailureMessage(failure, truckCopy(messages)));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TruckFormDialog
        open={dialog === 'edit'}
        truck={truck}
        messages={messages}
        onClose={onClose}
        onSaved={() => {
          showToast('success', messages.truckSaved);
          onClose();
          onChanged();
        }}
      />
      <Modal open={dialog === 'deactivate'} title={fillPlaceholders(messages.truckDeactivateTitle, { truck: truck.truckNumber })} onClose={onClose} closeLabel={messages.closeDialog}>
        <div className="space-y-4" data-testid="truck-deactivate-dialog">
          <p className="text-sm text-muted-foreground">{messages.truckDeactivateBody}</p>
          {openWorkOrder ? (
            <div className="rounded-xl border border-warning/40 bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
              {fillPlaceholders(messages.truckDeactivateBlocked, { workOrder: openWorkOrder.displayId })}{' '}
              <Link className="font-medium underline" href={`/admin/work-orders/${openWorkOrder.id}`}>{openWorkOrder.displayId}</Link>
            </div>
          ) : null}
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
            <Button type="button" variant="destructive" disabled={busy || Boolean(openWorkOrder)} onClick={() => void run(() => updateAdminTruck(truck.id, { active: false }), messages.truckDeactivated, onChanged)}>
              {messages.truckDeactivate}
            </Button>
          </DialogActions>
        </div>
      </Modal>
      <Modal open={dialog === 'disconnect-samsara' && Boolean(admin?.samsara.connectedVehicleId)} title={fillPlaceholders(messages.samsaraDisconnectTitle, { truck: truck.truckNumber })} onClose={onClose} closeLabel={messages.closeDialog}>
        <div className="space-y-4" data-testid="truck-samsara-disconnect-dialog">
          <p className="text-sm text-muted-foreground">{messages.samsaraDisconnectBody}</p>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void run(() => disconnectAdminTruckSamsara(truck.id), messages.samsaraDisconnected, onChanged)}>
              {messages.samsaraDisconnect}
            </Button>
          </DialogActions>
        </div>
      </Modal>
      <Modal open={dialog === 'delete' && Boolean(admin?.canDelete)} title={fillPlaceholders(messages.truckDeleteTitle, { truck: truck.truckNumber })} onClose={onClose} closeLabel={messages.closeDialog}>
        <div className="space-y-4" data-testid="truck-delete-dialog">
          <p className="text-sm text-muted-foreground">{messages.truckDeleteBody}</p>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void run(() => deleteAdminTruck(truck.id), messages.truckDeleted, onDeleted)}>
              {messages.truckDelete}
            </Button>
          </DialogActions>
        </div>
      </Modal>
    </>
  );
}

/** D44: reactivate straight from the inactive banner (nothing blocks it). */
export async function reactivateTruck(truckId: string) {
  return updateAdminTruck(truckId, { active: true });
}

/**
 * D44 §3–4 on the truck (Manager and System Admin): "Samsara: {name} · Disconnect" when connected; otherwise Connect
 * Samsara, and the sync's VIN proposal as a banner with a one-tap Connect. The "Yours · Samsara" step only appears when
 * a field differs (owner, 2026-10-14).
 */
export function TruckSamsaraPanel({
  truck,
  admin,
  messages,
  openWith = null,
  onChanged,
}: {
  truck: TruckDto;
  admin: AdminTruckAdminDto;
  messages: AdminMessages;
  /** Opened from Setup → Samsara when a field differs: start on this vehicle's comparison. */
  openWith?: string | null;
  onChanged: () => void;
}) {
  const { showToast } = useActionToast();
  const [connectOpen, setConnectOpen] = useState(Boolean(openWith));
  const [preselect, setPreselect] = useState<string | null>(openWith);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { connectedVehicleId, connectedVehicleName, proposedVehicleId } = admin.samsara;
  const inactive = Boolean(truck.deactivatedAt);

  async function connectProposed() {
    if (!proposedVehicleId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await connectAdminTruckSamsara(truck.id, { vehicleId: proposedVehicleId });
      showToast('success', result.synced ? fillPlaceholders(messages.samsaraConnectedToast, { name: result.connectedVehicleName }) : messages.samsaraConnectedNoSync);
      onChanged();
    } catch (failure) {
      // Something differs: the comparison decides, on that vehicle.
      if (apiErrorCode(failure) === 'SAMSARA_CHOICE_REQUIRED') {
        setPreselect(proposedVehicleId);
        setConnectOpen(true);
      } else {
        setError(adminWriteFailureMessage(failure, truckCopy(messages)));
      }
    } finally {
      setBusy(false);
    }
  }

  const proposed = !connectedVehicleId && proposedVehicleId && !inactive;
  // LTR-235: once connected there is nothing to do here; Disconnect is in the truck's "…" (an accidental tap on top
  // of the page should never cut the truck off Samsara). The Faults tab and the header already show the link.
  if (connectedVehicleId) return null;
  return (
    <div
      data-testid="truck-samsara"
      className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm', proposed ? 'border-primary/40 bg-primary/5' : 'bg-card')}
    >
      <p className="flex min-w-0 items-center gap-2">
        <Link2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        {connectedVehicleId
          ? <span>{fillPlaceholders(messages.samsaraConnectedLine, { name: connectedVehicleName || connectedVehicleId })}</span>
          : proposed
            ? <span className="font-medium" data-testid="truck-samsara-proposal">{messages.samsaraProposalBanner}</span>
            : <span className="text-muted-foreground">{messages.samsaraNotConnectedLine}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {inactive ? null : (
          <>
            {proposed ? <Button type="button" size="sm" disabled={busy} onClick={() => void connectProposed()}>{messages.samsaraConnectAction}</Button> : null}
            <Button type="button" variant={proposed ? 'outline' : 'secondary'} size="sm" disabled={busy} onClick={() => { setPreselect(null); setConnectOpen(true); }}>
              {messages.samsaraConnect}
            </Button>
          </>
        )}
      </div>
      {error && !connectOpen ? <InlineAlert className="w-full">{error}</InlineAlert> : null}

      <ConnectSamsaraDialog
        open={connectOpen}
        truck={truck}
        preselect={preselect}
        messages={messages}
        onClose={() => setConnectOpen(false)}
        onConnected={() => {
          setConnectOpen(false);
          onChanged();
        }}
      />
    </div>
  );
}

/** D44 §3–4: step 1 picks the vehicle (Suggested on top); step 2, only when something differs, compares field by field. */
function ConnectSamsaraDialog({
  open,
  truck,
  preselect,
  messages,
  onClose,
  onConnected,
}: {
  open: boolean;
  truck: TruckDto;
  preselect: string | null;
  messages: AdminMessages;
  onClose: () => void;
  onConnected: () => void;
}) {
  const { showToast } = useActionToast();
  const { data, error: loadError, isLoading, mutate } = useAdminTruckSamsaraCandidates(open ? truck.id : null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<SamsaraCandidateDto | null>(null);
  const [choose, setChoose] = useState<Partial<Record<SamsaraConnectField, 'ours' | 'samsara'>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPicked(null);
      setQuery('');
      setError(null);
    }
  }, [open]);

  // Opened on a known vehicle (the proposal, or from Setup → Samsara): straight to its comparison.
  useEffect(() => {
    if (!open || !preselect || picked || !data) return;
    const candidate = data.items.find((item) => item.id === preselect);
    if (candidate) pick(candidate, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselect, data]);

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    const all = data?.items ?? [];
    return term ? all.filter((item) => [item.name, item.vin, item.make, item.model, item.licensePlate].some((value) => value?.toLowerCase().includes(term))) : all;
  }, [data, query]);
  const rows = picked ? samsaraFieldRows(truck, picked) : [];

  function pick(candidate: SamsaraCandidateDto, oneTap = true) {
    const fieldRows = samsaraFieldRows(truck, candidate);
    // Owner (one-tap): nothing differs, so there is nothing to choose.
    if (oneTap && !needsComparison(fieldRows)) {
      void connect(candidate, {});
      return;
    }
    setPicked(candidate);
    // Differing fields keep ours unless the Manager picks Samsara: nothing is overwritten unseen (D43).
    setChoose(Object.fromEntries(fieldRows.filter((row) => row.state === 'differ').map((row) => [row.field, 'ours'])));
  }

  async function connect(candidate: SamsaraCandidateDto, choices: typeof choose) {
    setBusy(true);
    setError(null);
    try {
      const result = await connectAdminTruckSamsara(truck.id, { vehicleId: candidate.id, choose: choices });
      showToast('success', result.synced ? fillPlaceholders(messages.samsaraConnectedToast, { name: result.connectedVehicleName || candidate.id }) : messages.samsaraConnectedNoSync);
      onConnected();
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, truckCopy(messages)));
      if (apiErrorCode(failure) === 'SAMSARA_CHOICE_REQUIRED') pick(candidate, false);
    } finally {
      setBusy(false);
    }
  }

  const loadMessage = loadError instanceof ApiError ? adminWriteFailureMessage(loadError, truckCopy(messages)) : messages.samsaraLoadCandidatesFailed;

  return (
    <Modal open={open} title={fillPlaceholders(messages.samsaraConnectTitle, { truck: truck.truckNumber })} onClose={onClose} closeLabel={messages.closeDialog} className="sm:max-w-2xl">
      {picked ? (
        <div className="space-y-4" data-testid="samsara-compare">
          <div>
            <p className="font-semibold">{messages.samsaraCompareTitle}</p>
            <p className="text-sm text-muted-foreground">{picked.name || picked.id} · {messages.samsaraCompareHint}</p>
          </div>
          <CompareTable rows={rows} choose={choose} setChoose={setChoose} messages={messages} disabled={busy} />
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setPicked(null); setError(null); }}>{messages.samsaraBack}</Button>
            <Button type="button" disabled={busy} onClick={() => void connect(picked, choose)}>{messages.samsaraConnectAction}</Button>
          </DialogActions>
        </div>
      ) : (
        <div className="space-y-3" data-testid="samsara-candidates">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label={messages.samsaraConnectSearch} placeholder={messages.samsaraConnectSearch} value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" />
          </div>
          {loadError ? (
            <div className="space-y-2">
              <InlineAlert>{loadMessage}</InlineAlert>
              <Button type="button" variant="outline" size="sm" onClick={() => void mutate()}>{messages.retry}</Button>
            </div>
          ) : isLoading && !data ? (
            <CardListSkeleton count={3} />
          ) : items.length ? (
            <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" disabled={busy} className="flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-accent disabled:opacity-60" onClick={() => pick(item)}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.name || item.id}</span>
                      {item.suggested ? <Badge variant="success">{item.suggested === 'vin' ? messages.samsaraSuggestedVin : messages.samsaraSuggestedNumber}</Badge> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[item.vin, [item.year, item.make, item.model].filter(Boolean).join(' '), item.licensePlate].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{messages.samsaraNoCandidates}</p>
          )}
          {error ? <InlineAlert>{error}</InlineAlert> : null}
        </div>
      )}
    </Modal>
  );
}

function CompareTable({
  rows,
  choose,
  setChoose,
  messages,
  disabled,
}: {
  rows: SamsaraFieldRow[];
  choose: Partial<Record<SamsaraConnectField, 'ours' | 'samsara'>>;
  setChoose: (next: Partial<Record<SamsaraConnectField, 'ours' | 'samsara'>>) => void;
  messages: AdminMessages;
  disabled: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-2 pr-2 font-medium">{messages.samsaraColField}</th>
          <th className="py-2 pr-2 font-medium">{messages.samsaraColYours}</th>
          <th className="py-2 font-medium">{messages.samsaraColSamsaraValue}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.field} className="border-b last:border-0" data-state={row.state}>
            <td className="py-2 pr-2 text-muted-foreground">{String(messages[FIELD_LABEL[row.field]])}</td>
            {row.state === 'differ' ? (
              <>
                <td className="py-2 pr-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`samsara-${row.field}`} className="size-4 accent-primary" checked={choose[row.field] !== 'samsara'} disabled={disabled} onChange={() => setChoose({ ...choose, [row.field]: 'ours' })} />
                    <span className={row.field === 'vin' ? 'font-mono text-xs' : undefined}>{row.ours}</span>
                  </label>
                </td>
                <td className="py-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" name={`samsara-${row.field}`} className="size-4 accent-primary" checked={choose[row.field] === 'samsara'} disabled={disabled} onChange={() => setChoose({ ...choose, [row.field]: 'samsara' })} />
                    <span className={row.field === 'vin' ? 'font-mono text-xs' : undefined}>{row.theirs}</span>
                  </label>
                </td>
              </>
            ) : (
              <>
                <td className={cn('py-2 pr-2', row.field === 'vin' && 'font-mono text-xs')}>
                  {row.ours ?? <span className="text-muted-foreground">{row.state === 'fill' ? messages.samsaraWillFill : '—'}</span>}
                </td>
                <td className={cn('py-2', row.field === 'vin' && 'font-mono text-xs', row.state === 'fill' && 'font-medium')}>{row.theirs ?? '—'}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** D44: the inactive banner on the truck, with Reactivate for whoever can edit trucks. */
export function TruckInactiveBanner({ canWrite, busy, messages, onReactivate }: { canWrite: boolean; busy: boolean; messages: AdminMessages; onReactivate: () => void }) {
  return (
    <div role="status" data-testid="truck-inactive-banner" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-surface px-4 py-3 text-sm text-warning-foreground">
      <p className="flex items-center gap-2"><CircleAlert aria-hidden="true" className="size-4 shrink-0" />{messages.truckInactiveBanner}</p>
      {canWrite ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onReactivate}>{messages.truckReactivate}</Button> : null}
    </div>
  );
}
