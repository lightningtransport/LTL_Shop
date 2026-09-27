'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkPmObservedMileage, type PmServiceDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { formatMileage } from '@/lib/format';
import { pmSaveStatus } from '@/lib/pm-save-status';
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
  confirmLargeMileageJump?: boolean;
};

function payloadFor(mileage: string, selections: Record<string, string>, confirmLargeMileageJump = false): Payload {
  return {
    observedMileage: mileage.trim() === '' ? null : Number(mileage),
    selections: Object.entries(selections)
      .filter(([, partId]) => Boolean(partId))
      .map(([partCategoryId, partId]) => ({ partCategoryId, partId })),
    ...(confirmLargeMileageJump ? { confirmLargeMileageJump: true } : {}),
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
  const [savedOnce, setSavedOnce] = useState(false);
  // LTR-135: a jump above the threshold is saved only after explicit confirmation.
  const [jumpConfirmed, setJumpConfirmed] = useState(false);
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
      // A mileage the API already accepted was confirmed when it was saved.
      setJumpConfirmed(nextMileage !== '');
      setSelections(nextSelections);
      lastSavedKey.current = JSON.stringify(payloadFor(nextMileage, nextSelections, nextMileage !== ''));
      queuedPayload.current = null;
      dirtyRef.current = false;
      setDirty(false);
      setSaveError(null);
      setHydrated(true);
    }
  }, [data]);

  const draft = useMemo(
    () => payloadFor(mileage, selections, jumpConfirmed),
    [jumpConfirmed, mileage, selections],
  );
  const currentTruckMileage = data?.currentTruckMileage ?? null;
  const mileageCheck = useMemo(
    () => (/^\d+$/.test(mileage) ? checkPmObservedMileage(Number(mileage), currentTruckMileage) : null),
    [currentTruckMileage, mileage],
  );
  const mileageBelowCurrent = !!data?.canEdit && mileageCheck?.ok === false;
  const mileageNeedsConfirmation = !!data?.canEdit && mileageCheck?.ok === true
    && mileageCheck.needsConfirmation && !jumpConfirmed;
  const mileageBlocked = mileageBelowCurrent || mileageNeedsConfirmation;

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
        setSavedOnce(true);
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
    const check = checkPmObservedMileage(payload.observedMileage, data.currentTruckMileage);
    if (!check.ok || (check.needsConfirmation && !payload.confirmLargeMileageJump)) return;
    queuedPayload.current = payload;
    void flushSaveQueue();
  }, [data?.canEdit, data?.currentTruckMileage, flushSaveQueue]);

  useEffect(() => {
    if (!hydrated || !data?.canEdit || !dirty || saveError || mileageBlocked) return;
    const timer = window.setTimeout(() => persist(draft), 600);
    return () => window.clearTimeout(timer);
  }, [data?.canEdit, dirty, draft, hydrated, mileageBlocked, persist, saveError]);

  useEffect(() => {
    onDraftStateChange?.({
      ready: !!data,
      pending: dirty || saving,
      hasError: !!saveError || mileageBlocked,
      observedMileage: mileage,
      selectedParts: draft.selections.length,
    });
  }, [data, dirty, draft.selections.length, mileage, mileageBlocked, onDraftStateChange, saveError, saving]);

  const saveStatus = pmSaveStatus({ saving, dirty, saveError, savedOnce });

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

  if (data.serviceCompletedAt) {
    // LTR-137 / LTR-139: a completed PM is history — show what was recorded, not editable fields.
    return <CompletedPmSummary data={data} />;
  }

  const canEdit = data.canEdit;
  const hasValidObservedMileage = /^\d+$/.test(mileage);
  const hasHistoricalParts = !canEdit && data.selections.length > 0;
  const showParts = (hasValidObservedMileage && !mileageBelowCurrent) || hasHistoricalParts;
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
              setJumpConfirmed(false);
              dirtyRef.current = true;
              setDirty(true);
              setSaveError(null);
            }}
            aria-invalid={mileageBelowCurrent || undefined}
            onBlur={() => void persist(payloadFor(mileage, selections, jumpConfirmed))}
          />
          <span id="pm-observed-mileage-unit" className="text-sm text-muted-foreground">mi</span>
        </div>
        {mileageBelowCurrent && mileageCheck?.ok === false ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {messages.mileageBelowCurrent(formatMileage(mileageCheck.currentMileage))}
          </p>
        ) : null}
        {mileageNeedsConfirmation ? (
          <div className="mt-2 space-y-2 rounded-lg bg-warning-surface px-3 py-2 text-sm text-warning-foreground" role="alert">
            <p>{messages.mileageJumpWarning(formatMileage(currentTruckMileage))}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setJumpConfirmed(true);
                persist(payloadFor(mileage, selections, true));
              }}
            >
              {messages.confirmMileage}
            </Button>
          </div>
        ) : null}
        {!showParts && !mileageBelowCurrent ? (
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
                  void persist(payloadFor(mileage, nextSelections, jumpConfirmed));
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
        {saveStatus === 'saving' ? <span className="text-muted-foreground">{messages.saving}</span> : null}
        {saveStatus === 'saved' ? <span className="text-muted-foreground">{messages.saved}</span> : null}
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

function CompletedPmSummary({ data }: { data: PmServiceDto }) {
  const { messages } = useShopLocale();
  const dateFormat = new Intl.DateTimeFormat(messages.locale === 'es' ? 'es-US' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const usedParts = data.selections.flatMap((selection) => {
    const category = data.categories.find((item) => item.id === selection.partCategoryId);
    const part = category?.parts.find((item) => item.id === selection.partId);
    return category && part ? [{ category: category.name, part }] : [];
  });
  const previousPm = !data.lastCompletedPm
    ? messages.noPriorPm
    : `${data.lastCompletedPm.displayId} · ${data.lastCompletedPm.observedMileage === null ? messages.mileageNotRecorded : formatMileage(data.lastCompletedPm.observedMileage)}`;

  return (
    <Card className="mb-4 space-y-4" aria-labelledby="pm-service-title">
      <div>
        <h2 id="pm-service-title" className="section-label">{messages.pmServiceLabel}</h2>
        {data.serviceCompletedAt ? (
          <p className="mt-1 text-sm text-muted-foreground">{messages.pmCompletedOn(dateFormat.format(new Date(data.serviceCompletedAt)))}</p>
        ) : null}
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">{messages.mileageAtThisPm}</dt>
          <dd className="font-medium">{formatMileage(data.observedMileage)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{messages.previousPm}</dt>
          <dd className="font-medium">{previousPm}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{messages.truckMileageToday}</dt>
          <dd className="font-medium">{formatMileage(data.currentTruckMileage)}</dd>
        </div>
      </dl>
      <div>
        <p className="section-label">{messages.partsUsed}</p>
        {usedParts.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {usedParts.map(({ category, part }) => (
              <li key={part.id}>
                <span className="text-muted-foreground">{category}:</span>{' '}
                {part.partNumber ? `${part.partNumber} — ${part.displayName}` : part.displayName}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{messages.noPartsRecorded}</p>
        )}
      </div>
    </Card>
  );
}
