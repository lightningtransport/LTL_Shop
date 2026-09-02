'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PmServiceDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { formatMileage } from '@/lib/format';
import { shopKeys, usePmService } from '@/lib/shop-data';
import { Card, Input, Label, Select } from '@/components/ui';

export type PmDraftState = {
  ready: boolean;
  pending: boolean;
  hasError: boolean;
  observedMileage: string;
  selectedParts: number;
};

type Payload = {
  observedMileage: number | null;
  selections: { partCategoryId: string; partId: string }[];
};

function payloadFor(mileage: string, selections: Record<string, string>): Payload {
  return {
    observedMileage: mileage.trim() === '' ? null : Number(mileage),
    selections: Object.entries(selections)
      .filter(([, partId]) => Boolean(partId))
      .map(([partCategoryId, partId]) => ({ partCategoryId, partId })),
  };
}

export function PmServiceCard({
  workOrderId,
  onDraftStateChange,
}: {
  workOrderId: string;
  onDraftStateChange?: (state: PmDraftState) => void;
}) {
  const { data, error, mutate } = usePmService(workOrderId, true);
  const [mileage, setMileage] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSavedKey = useRef('');
  const savingKey = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const nextMileage = data.observedMileage?.toString() ?? '';
    const nextSelections = Object.fromEntries(
      data.selections.map((item) => [item.partCategoryId, item.partId]),
    );
    setMileage(nextMileage);
    setSelections(nextSelections);
    lastSavedKey.current = JSON.stringify(payloadFor(nextMileage, nextSelections));
    setDirty(false);
    setSaveError(null);
    setHydrated(true);
  }, [data]);

  const draft = useMemo(() => payloadFor(mileage, selections), [mileage, selections]);

  async function persist(payload: Payload) {
    const key = JSON.stringify(payload);
    if (!data?.canEdit || key === lastSavedKey.current || key === savingKey.current) return;
    savingKey.current = key;
    setDirty(false);
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiFetch<PmServiceDto>(shopKeys.pmService(workOrderId), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      lastSavedKey.current = key;
      await mutate(updated, { revalidate: false });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save PM service details.');
      setDirty(true);
    } finally {
      savingKey.current = null;
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!hydrated || !data?.canEdit || !dirty || saveError) return;
    const timer = window.setTimeout(() => void persist(draft), 600);
    return () => window.clearTimeout(timer);
  }, [data?.canEdit, dirty, draft, hydrated, saveError]);

  useEffect(() => {
    onDraftStateChange?.({
      ready: !!data,
      pending: dirty || saving,
      hasError: !!saveError,
      observedMileage: mileage,
      selectedParts: draft.selections.length,
    });
  }, [data, dirty, draft.selections.length, mileage, onDraftStateChange, saveError, saving]);

  if (error instanceof Error) {
    return <p className="mb-4 text-sm text-destructive" role="alert">Unable to load PM service details.</p>;
  }
  if (!data) return <Card className="mb-4 text-sm text-muted-foreground">Loading PM service details…</Card>;

  const canEdit = data.canEdit && !saving;
  const lastPmValue = data.lastCompletedPm
    ? `${data.lastCompletedPm.displayId} · ${formatMileage(data.lastCompletedPm.observedMileage)} · ${new Date(data.lastCompletedPm.completedAt).toLocaleDateString()}`
    : 'No prior PM recorded';

  return (
    <Card className="mb-4 space-y-4" aria-labelledby="pm-service-title">
      <h2 id="pm-service-title" className="section-label">PM Service</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pm-current-mileage">Current truck mileage</Label>
          <Input id="pm-current-mileage" className="mt-2" readOnly value={formatMileage(data.currentTruckMileage)} />
        </div>
        <div>
          <Label htmlFor="pm-last-record">Last completed PM</Label>
          <Input id="pm-last-record" className="mt-2" readOnly value={lastPmValue} />
        </div>
      </div>

      <div>
        <Label htmlFor="pm-observed-mileage">Observed mileage</Label>
        <Input
          id="pm-observed-mileage"
          className="mt-2"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={mileage}
          disabled={!canEdit}
          onChange={(event) => {
            setMileage(event.target.value.replace(/\D/g, ''));
            setDirty(true);
            setSaveError(null);
          }}
          onBlur={() => void persist(payloadFor(mileage, selections))}
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
              disabled={!canEdit}
              onChange={(event) => {
                const nextSelections = { ...selections, [category.id]: event.target.value };
                setSelections(nextSelections);
                setDirty(true);
                setSaveError(null);
                void persist(payloadFor(mileage, nextSelections));
              }}
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

      <div className="min-h-5 text-sm" aria-live="polite">
        {saving ? <span className="text-muted-foreground">Saving…</span> : null}
        {!saving && !dirty && !saveError && hydrated ? <span className="text-muted-foreground">Saved</span> : null}
        {saveError ? (
          <span className="text-destructive" role="alert">
            {saveError}{' '}
            <button className="underline" type="button" onClick={() => void persist(draft)}>Retry</button>
          </span>
        ) : null}
      </div>
    </Card>
  );
}
