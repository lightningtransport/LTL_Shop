'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SamsaraTruckPreviewDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { truckCopy } from './admin-truck-admin';
import { Button, DialogActions, InlineAlert, Modal } from './ui';
import { createAdminTruckFromSamsara, fetchAdminTruckFromSamsara } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';
import { adminTruckHref } from '@/lib/admin-truck-origin';
import { formatVehicleYmm } from '@/lib/format';
import { adminWriteFailureMessage } from '@/lib/system-admin';

/**
 * D50: Yard → Dispatch names a truck the Shop app does not have. Look it up in Samsara (Dispatch's own link first, then
 * the vehicle with that number) and, on confirm, create it with Samsara's number, VIN, make, model, year and plate and
 * connect it (D44 §4). Owner, company, dispatcher and insurance are filled in later on the truck.
 */
export function AddFromSamsaraDialog({
  target,
  from,
  messages,
  onClose,
  onAdded,
}: {
  target: { truckNumber: string; samsaraVehicleId: string | null } | null;
  from: string;
  messages: AdminMessages;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { showToast } = useActionToast();
  const [preview, setPreview] = useState<SamsaraTruckPreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const truck = target?.truckNumber ?? '';

  useEffect(() => {
    setPreview(null);
    setError(null);
    if (!target) return;
    let live = true;
    fetchAdminTruckFromSamsara(target.truckNumber, target.samsaraVehicleId)
      .then((result) => { if (live) setPreview(result); })
      .catch((failure: unknown) => { if (live) setError(adminWriteFailureMessage(failure, truckCopy(messages))); });
    return () => { live = false; };
  }, [target, messages]);

  async function add() {
    if (!preview?.vehicle) return;
    setBusy(true);
    setError(null);
    try {
      await createAdminTruckFromSamsara(preview.truckNumber, preview.vehicle.id);
      showToast('success', fillPlaceholders(messages.addFromSamsaraDone, { truck }));
      onAdded();
      onClose();
    } catch (failure) {
      setError(adminWriteFailureMessage(failure, truckCopy(messages)));
    } finally {
      setBusy(false);
    }
  }

  const vehicle = preview?.vehicle ?? null;
  return (
    <Modal open={Boolean(target)} title={fillPlaceholders(messages.addFromSamsaraTitle, { truck })} onClose={onClose} closeLabel={messages.closeDialog}>
      <div className="space-y-4" data-testid="add-from-samsara-dialog">
        {!preview && !error ? <p className="text-muted-foreground">{fillPlaceholders(messages.addFromSamsaraLooking, { truck })}</p> : null}
        {preview?.existingTruckId ? (
          <p>
            {fillPlaceholders(messages.addFromSamsaraExists, { truck })}{' '}
            <Link className="text-primary underline underline-offset-2" href={adminTruckHref(preview.existingTruckId, from)}>{messages.addFromSamsaraOpen}</Link>
          </p>
        ) : null}
        {preview && !preview.existingTruckId && !vehicle ? <p>{fillPlaceholders(messages.addFromSamsaraNone, { truck })}</p> : null}
        {vehicle ? (
          <>
            <p className="text-muted-foreground">{fillPlaceholders(messages.addFromSamsaraBody, { truck })}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{messages.addFromSamsaraVehicle}</dt><dd className="text-right font-medium">{vehicle.name || vehicle.id}</dd>
              <dt className="text-muted-foreground">{messages.vehicleLabel}</dt><dd className="text-right font-medium">{formatVehicleYmm(vehicle) || messages.noValue}</dd>
              <dt className="text-muted-foreground">VIN</dt><dd className="text-right font-mono">{vehicle.vin ?? messages.noValue}</dd>
              <dt className="text-muted-foreground">{messages.truckFieldPlate}</dt><dd className="text-right font-medium">{vehicle.licensePlate ?? messages.noValue}</dd>
            </dl>
          </>
        ) : null}
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{messages.cancel}</Button>
          {vehicle ? <Button type="button" disabled={busy} onClick={() => void add()}>{fillPlaceholders(messages.addFromSamsaraConfirm, { truck })}</Button> : null}
        </DialogActions>
      </div>
    </Modal>
  );
}
