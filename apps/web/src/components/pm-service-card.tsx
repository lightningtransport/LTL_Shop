'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PmServiceDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { formatMileage } from '@/lib/format';
import { shopKeys, usePmService } from '@/lib/shop-data';
import { Button, Card, Input, Label, LoadFailure, Select } from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';

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

function displayObservedMileage(mileage: string) {
  return mileage ? Number(mileage).toLocaleString('en-US') : '';
}

export function PmServiceCard({
  workOrderId,
  onDraftStateChange,
}: {
  workOrderId: string;
  onDraftStateChange?: (state: PmDraftState) => void;
}) {
  const { messages } = useShopLocale();
  const { data, error, mutate } = usePmService(workOrderId, true);
  const [mileage, setMileage] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSavedKey = useRef('');
  const queuedPayload = useRef<Payload | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    const nextMileage = data.observedMileage?.toString() ?? '';
    const nextSelections = Object.fromEntries(
      data.selections.map((item) => [item.partCategoryId, item.partId]),
    );
    // SWR revalidations must never overwrite an in-progress local draft.
    if (!hydrated || (!dirtyRef.current && !savingRef.current)) {
      setMileage(nextMileage);
      setSelections(nextSelections);
      lastSavedKey.current = JSON.stringify(payloadFor(nextMileage, nextSelections));
      queuedPayload.current = null;
      dirtyRef.current = false;
      setDirty(false);
      setSaveError(null);
      setHydrated(true);
    }
  }, [data]);

  const draft = useMemo(() => payloadFor(mileage, selections), [mileage, selections]);

  const flushSaveQueue = useCallback(async () => {
    if (!data?.canEdit || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    try {
      while (queuedPayload.current) {
        const nextPayload = queuedPayload.current;
        const key = JSON.stringify(nextPayload);
        if (key === lastSavedKey.current) {
          queuedPayload.current = null;
          continue;
        }

        queuedPayload.current = null;
        const updated = await apiFetch<PmServiceDto>(shopKeys.pmService(workOrderId), {
          method: 'POST',
          body: JSON.stringify(nextPayload),
        });
        lastSavedKey.current = key;
        await mutate(updated, { revalidate: false });
      }
      dirtyRef.current = false;
      setDirty(false);
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : messages.unableToSavePmDetails);
      dirtyRef.current = true;
      setDirty(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [data?.canEdit, messages.unableToSavePmDetails, mutate, workOrderId]);

  const persist = useCallback((payload: Payload) => {
    if (!data?.canEdit) return;
    queuedPayload.current = payload;
    void flushSaveQueue();
  }, [data?.canEdit, flushSaveQueue]);

  useEffect(() => {
    if (!hydrated || !data?.canEdit || !dirty || saveError) return;
    const timer = window.setTimeout(() => persist(draft), 600);
    return () => window.clearTimeout(timer);
  }, [data?.canEdit, dirty, draft, hydrated, persist, saveError]);

  useEffect(() => {
    onDraftStateChange?.({
      ready: !!data,
      pending: dirty || saving,
      hasError: !!saveError,
      observedMileage: mileage,
      selectedParts: draft.selections.length,
    });
  }, [data, dirty, draft.selections.length, mileage, onDraftStateChange, saveError, saving]);

  if (error) {
    return (
      <div className="mb-4">
        <LoadFailure
          message={messages.pmServiceLoadError}
          retryLabel={messages.retry}
          onRetry={() => void mutate()}
        />
      </div>
    );
  }
  if (!data) return <Card className="mb-4 text-sm text-muted-foreground">{messages.loadingPmService}</Card>;

  const canEdit = data.canEdit;
  const hasValidObservedMileage = /^\d+$/.test(mileage);
  const hasHistoricalParts = !canEdit && data.selections.length > 0;
  const showParts = hasValidObservedMileage || hasHistoricalParts;
  const lastPmValue = !data.lastCompletedPm
    ? messages.noPriorPm
    : data.lastCompletedPm.observedMileage === null
      ? messages.mileageNotRecorded
      : formatMileage(data.lastCompletedPm.observedMileage);

  return (
    <Card className="mb-4 space-y-4" aria-labelledby="pm-service-title">
      <h2 id="pm-service-title" className="section-label">{messages.pmServiceLabel}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pm-current-mileage">{messages.currentTruckMileage}</Label>
          <Input id="pm-current-mileage" className="mt-2" readOnly value={formatMileage(data.currentTruckMileage)} />
        </div>
        <div>
          <Label htmlFor="pm-last-record">{messages.lastCompletedPm}</Label>
          <Input id="pm-last-record" className="mt-2" readOnly value={lastPmValue} />
        </div>
      </div>

      <div>
        <Label htmlFor="pm-observed-mileage">{messages.observedMileage}</Label>
        <div className="mt-2 flex items-center gap-2">
          <Input
            id="pm-observed-mileage"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={displayObservedMileage(mileage)}
            aria-describedby="pm-observed-mileage-unit"
            disabled={!canEdit}
            onChange={(event) => {
              setMileage(event.target.value.replace(/\D/g, ''));
              dirtyRef.current = true;
              setDirty(true);
              setSaveError(null);
            }}
            onBlur={() => void persist(payloadFor(mileage, selections))}
          />
          <span id="pm-observed-mileage-unit" className="text-sm text-muted-foreground">mi</span>
        </div>
        {!showParts ? (
          <p className="mt-2 text-sm text-muted-foreground" id="pm-parts-instruction">
            {messages.enterMileageHint}
          </p>
        ) : null}
      </div>

      {showParts ? <div className="space-y-3">
        <p className="section-label">{messages.partsUsed}</p>
        {data.categories.map((category) => (
          <div key={category.id}>
            <Label htmlFor={`pm-part-${category.id}`}>{category.name}</Label>
            {category.parts.length ? (
              <Select
                id={`pm-part-${category.id}`}
                className="mt-2"
                value={selections[category.id] ?? ''}
                disabled={!canEdit}
                onChange={(event) => {
                  const nextSelections = { ...selections, [category.id]: event.target.value };
                  setSelections(nextSelections);
                  dirtyRef.current = true;
                  setDirty(true);
                  setSaveError(null);
                  void persist(payloadFor(mileage, nextSelections));
                }}
              >
                <option value="">{messages.noPartUsed}</option>
                {category.parts.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.partNumber ? `${part.partNumber} — ${part.displayName}` : part.displayName}
                  </option>
                ))}
              </Select>
            ) : (
              <Select id={`pm-part-${category.id}`} className="mt-2" value="" disabled aria-label={`${category.name}: ${messages.noCompatibleParts}`}>
                <option>{messages.noCompatibleParts}</option>
              </Select>
            )}
          </div>
        ))}
      </div> : null}

      <div className="min-h-5 text-sm" aria-live="polite">
        {saving ? <span className="text-muted-foreground">{messages.saving}</span> : null}
        {!saving && !dirty && !saveError && hydrated ? <span className="text-muted-foreground">{messages.saved}</span> : null}
        {saveError ? (
          <span className="text-destructive" role="alert">
            {saveError}{' '}
          <Button variant="ghost" className="ml-1 px-2 underline" onClick={() => persist(draft)}>{messages.retry}</Button>
          </span>
        ) : null}
      </div>
    </Card>
  );
}
