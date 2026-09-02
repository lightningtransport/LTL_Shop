'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PmServiceDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { formatMileage } from '@/lib/format';
import { shopKeys, usePmService } from '@/lib/shop-data';
import { Button, Card, Input, Label, Modal, Select } from '@/components/ui';

export function PmServiceCard({ workOrderId }: { workOrderId: string }) {
  const { data, error, mutate } = usePmService(workOrderId, true);
  const [mileage, setMileage] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setMileage(data.observedMileage?.toString() ?? '');
    setSelections(Object.fromEntries(data.selections.map((item) => [item.partCategoryId, item.partId])));
  }, [data]);

  const changedMileage = useMemo(() => {
    if (!data || mileage.trim() === '') return false;
    return Number(mileage) !== data.currentTruckMileage;
  }, [data, mileage]);

  if (error instanceof Error) {
    return <p className="mb-4 text-sm text-destructive" role="alert">Unable to load PM service details.</p>;
  }
  if (!data) return <Card className="mb-4 text-sm text-muted-foreground">Loading PM service details…</Card>;

  function requestSave() {
    setSaveError(null);
    if (mileage.trim() !== '' && (!Number.isInteger(Number(mileage)) || Number(mileage) < 0)) {
      setSaveError('Observed mileage must be a whole, non-negative number.');
      return;
    }
    if (changedMileage) setConfirmOpen(true);
    else void save();
  }

  async function save() {
    setConfirmOpen(false);
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiFetch<PmServiceDto>(shopKeys.pmService(workOrderId), {
        method: 'POST',
        body: JSON.stringify({
          observedMileage: mileage.trim() === '' ? null : Number(mileage),
          selections: Object.entries(selections)
            .filter(([, partId]) => Boolean(partId))
            .map(([partCategoryId, partId]) => ({ partCategoryId, partId })),
        }),
      });
      await mutate(updated, { revalidate: false });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save PM service details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4 space-y-4" aria-labelledby="pm-service-title">
      <div>
        <h2 id="pm-service-title" className="section-label">PM Service</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Current truck mileage: {formatMileage(data.currentTruckMileage)}
        </p>
        <p className="text-sm text-muted-foreground">
          {data.lastCompletedPm
            ? `Last PM: ${data.lastCompletedPm.displayId} · ${formatMileage(data.lastCompletedPm.observedMileage)} · ${new Date(data.lastCompletedPm.completedAt).toLocaleDateString()}`
            : 'No prior PM recorded.'}
        </p>
      </div>

      <div>
        <Label htmlFor="pm-observed-mileage">Observed mileage</Label>
        <Input
          id="pm-observed-mileage"
          className="mt-2"
          inputMode="numeric"
          type="number"
          min="0"
          value={mileage}
          disabled={!data.canEdit || saving}
          onChange={(event) => setMileage(event.target.value)}
        />
      </div>

      <div className="space-y-3">
        <p className="section-label">Parts used</p>
        {data.categories.map((category) => (
          <div key={category.id}>
            <Label htmlFor={`pm-part-${category.id}`}>{category.name}</Label>
            <Select
              id={`pm-part-${category.id}`}
              className="mt-2"
              value={selections[category.id] ?? ''}
              disabled={!data.canEdit || saving}
              onChange={(event) => setSelections((current) => ({ ...current, [category.id]: event.target.value }))}
            >
              <option value="">No part used</option>
              {category.parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.partNumber ? `${part.partNumber} — ${part.displayName}` : part.displayName}
                </option>
              ))}
            </Select>
            {!category.parts.length ? <p className="mt-1 text-xs text-muted-foreground">No compatible parts configured for this truck.</p> : null}
          </div>
        ))}
      </div>

      {saveError ? <p className="text-sm text-destructive" role="alert">{saveError}</p> : null}
      {data.canEdit ? <Button className="w-full" disabled={saving} onClick={requestSave}>Save PM service</Button> : <p className="text-sm text-muted-foreground">PM details are read-only for administrators.</p>}

      <Modal open={confirmOpen} title="Confirm mileage update" onClose={() => setConfirmOpen(false)}>
        <p className="mb-4 text-sm text-muted-foreground">This changes the truck’s stored mileage from {formatMileage(data.currentTruckMileage)} to {formatMileage(Number(mileage))} and records an audit entry.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={() => void save()}>Confirm update</Button>
        </div>
      </Modal>
    </Card>
  );
}
