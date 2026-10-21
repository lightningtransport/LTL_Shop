'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkPmObservedMileage, samsaraMileageGap, type PmServiceDto } from '@ltl-shop/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { intlLocale } from '@/lib/shop-locale';
import { formatMileage } from '@/lib/format';
import { formatAdminAgo } from '@/lib/admin-format';
import { pmSaveStatus } from '@/lib/pm-save-status';
import { shopKeys, usePmService } from '@/lib/shop-data';
import { Button, Card, CardListSkeleton, Input, Label, LoadFailure, SectionCard, Select } from '@/components/ui';
import { CircleAlert, CircleCheck, Sparkles } from 'lucide-react';
import { useShopLocale } from '@/lib/locale-context';

export type PmDraftState = {
  ready: boolean;
  pending: boolean;
  hasError: boolean;
  observedMileage: string;
  selectedParts: number;
  /** Stage PM-2: why Finish waits (the Finish bar says it) and what will be recorded (its confirmation). */
  blockReason?: 'enter' | 'below' | 'confirm' | 'choose' | 'offline' | null;
  chooseCategory?: string | null;
  offline?: boolean;
  parts?: Array<{ category: string; label: string }>;
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

/** Block A (PM1): what the mechanic entered stays on this phone until the Shop has saved it. */
type StoredDraft = { mileage: string; selections: Record<string, string>; jumpConfirmed: boolean };

function draftKey(workOrderId: string) {
  return `ltl-pm-draft:${workOrderId}`;
}

function readStoredDraft(workOrderId: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(workOrderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (typeof parsed.mileage !== 'string' || typeof parsed.selections !== 'object' || !parsed.selections) return null;
    return { mileage: parsed.mileage, selections: parsed.selections, jumpConfirmed: Boolean(parsed.jumpConfirmed) };
  } catch {
    return null;
  }
}

function writeStoredDraft(workOrderId: string, draft: StoredDraft | null) {
  try {
    if (draft) window.localStorage.setItem(draftKey(workOrderId), JSON.stringify(draft));
    else window.localStorage.removeItem(draftKey(workOrderId));
  } catch {
    // Storage can be unavailable (private mode); the draft then lives only in this screen.
  }
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
  // Block A (PM1): the last failure was the connection, so the entry waits on this phone.
  const [offlineError, setOfflineError] = useState(false);
  // Stage PM-2 (UX-7-002): "can't be lower" shows once the mechanic leaves the field, not from the first digit.
  const [mileageTouched, setMileageTouched] = useState(false);
  // Stage PM-2 (D-PM1): a category switched on without history waits for the mechanic to choose the part.
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
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
      // Block A (PM1): an entry that never reached the Shop comes back on this phone, and is sent again.
      if (!hydrated) {
        const stored = data.canEdit && !data.serviceCompletedAt ? readStoredDraft(workOrderId) : null;
        if (stored && JSON.stringify(payloadFor(stored.mileage, stored.selections)) !== JSON.stringify(payloadFor(nextMileage, nextSelections))) {
          setMileage(stored.mileage);
          setSelections(stored.selections);
          setJumpConfirmed(stored.jumpConfirmed);
          dirtyRef.current = true;
          setDirty(true);
        } else {
          writeStoredDraft(workOrderId, null);
        }
      }
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
  // Block A (PM3): clearing the field never saves an empty mileage; the last saved one stays.
  const mileageEmpty = !!data?.canEdit && hydrated && mileage === '';
  const mileageBlocked = mileageBelowCurrent || mileageNeedsConfirmation || mileageEmpty;
  // D35 / S4-1: Samsara as a reference; past 50 mi a gentle check that never blocks saving (the dashboard is official).
  const samsara = data?.samsaraOdometer ?? null;
  const samsaraGap = /^\d+$/.test(mileage) ? samsaraMileageGap(Number(mileage), samsara?.miles) : null;

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
      setOfflineError(false);
      writeStoredDraft(workOrderId, null);
    } catch (err) {
      // Block A (A5): the API's English sentence is not shown as is; Spanish gets its own copy.
      const offline = err instanceof ApiError && (err.kind === 'network' || err.kind === 'timeout');
      setOfflineError(offline);
      setSaveError(offline ? messages.pmKeptOnPhone : apiErrorMessage(err, messages, messages.unableToSavePmDetails));
      dirtyRef.current = true;
      setDirty(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [data?.canEdit, messages, mutate, workOrderId]);

  const persist = useCallback((payload: Payload) => {
    if (!data?.canEdit || payload.observedMileage === null) return;
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

  // Block A (PM1): keep the unsent entry on this phone, and send it again when the connection is back.
  useEffect(() => {
    if (!hydrated || !data?.canEdit || !dirty) return;
    writeStoredDraft(workOrderId, { mileage, selections, jumpConfirmed });
  }, [data?.canEdit, dirty, hydrated, jumpConfirmed, mileage, selections, workOrderId]);

  useEffect(() => {
    if (!saveError) return;
    const retry = () => setSaveError(null);
    window.addEventListener('online', retry);
    // A dropped connection that never fires "offline" still gets another try.
    const timer = offlineError ? window.setInterval(retry, 15_000) : undefined;
    return () => {
      window.removeEventListener('online', retry);
      if (timer) window.clearInterval(timer);
    };
  }, [offlineError, saveError]);

  useEffect(() => {
    const partLabel = (categoryId: string, partId: string) => {
      const category = data?.categories.find((item) => item.id === categoryId);
      const part = category?.parts.find((item) => item.id === partId);
      return category && part ? { category: category.name, label: part.partNumber ? `${part.partNumber} — ${part.displayName}` : part.displayName } : null;
    };
    const chooseCategory = pendingCategories.length
      ? data?.categories.find((category) => category.id === pendingCategories[0])?.name ?? null
      : null;
    onDraftStateChange?.({
      ready: !!data,
      pending: dirty || saving,
      hasError: !!saveError || mileageBlocked || pendingCategories.length > 0,
      observedMileage: mileage,
      selectedParts: draft.selections.length,
      blockReason: mileageEmpty ? 'enter' : mileageBelowCurrent ? 'below' : mileageNeedsConfirmation ? 'confirm' : chooseCategory ? 'choose' : offlineError ? 'offline' : null,
      chooseCategory,
      offline: offlineError,
      parts: draft.selections.map((item) => partLabel(item.partCategoryId, item.partId)).filter((item): item is { category: string; label: string } => Boolean(item)),
    });
  }, [data, dirty, draft.selections, mileage, mileageBelowCurrent, mileageBlocked, mileageEmpty, mileageNeedsConfirmation, offlineError, onDraftStateChange, pendingCategories, saveError, saving]);

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
  // Stage PM-2 (UX-6-005): the form's shape while it loads, and no Finish yet.
  if (!data) return <div role="status" aria-label={messages.loadingPmService} className="mb-4"><CardListSkeleton count={2} /></div>;

  if (data.serviceCompletedAt) {
    // LTR-137 / LTR-139: a completed PM is history — show what was recorded, not editable fields.
    return <CompletedPmSummary data={data} />;
  }

  const canEdit = data.canEdit;
  const hasValidObservedMileage = /^\d+$/.test(mileage);
  const showBelow = mileageBelowCurrent && mileageTouched;
  // Block A (PM2, PM3): a part chosen now could not be saved, so the parts wait until the mileage can be.
  const partsLocked = mileageNeedsConfirmation || mileageEmpty || mileageBelowCurrent || !hasValidObservedMileage;
  const usable = data.categories.filter((category) => category.parts.length > 0);
  const chosen = draft.selections.length;
  const onPhone = saveError && offlineError ? Math.max(1, chosen) : 0;
  const lastPm = data.lastCompletedPm;
  const dateOnly = (iso: string) => new Intl.DateTimeFormat(intlLocale(messages.locale), { month: 'short', day: 'numeric' }).format(new Date(iso));
  const mileageOk = hasValidObservedMileage && !mileageBelowCurrent && !mileageNeedsConfirmation;

  const setPart = (categoryId: string, partId: string) => {
    const next = { ...selections, [categoryId]: partId };
    if (!partId) delete next[categoryId];
    setSelections(next);
    setPendingCategories((list) => list.filter((id) => id !== categoryId));
    dirtyRef.current = true;
    setDirty(true);
    setSaveError(null);
    void persist(payloadFor(mileage, next, jumpConfirmed));
  };
  const toggleCategory = (category: (typeof usable)[number], on: boolean) => {
    if (!on) {
      setPendingCategories((list) => list.filter((id) => id !== category.id));
      setPart(category.id, '');
      return;
    }
    // D-PM1: the part used most on this model is chosen; without history the mechanic chooses it.
    const best = category.mostUsedPartId && category.parts.some((part) => part.id === category.mostUsedPartId) ? category.mostUsedPartId : null;
    if (best) setPart(category.id, best);
    else setPendingCategories((list) => [...new Set([...list, category.id])]);
  };

  return (
    <div className="mb-4 space-y-4">
      {/* Stage PM-2: what is missing, at a glance, and whether it is saved. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-4 py-3 text-sm" data-testid="pm-summary">
        <span className={`flex items-center gap-1.5 font-medium ${mileageOk ? 'text-success' : 'text-warning-foreground dark:text-warning'}`}>
          {mileageOk ? <CircleCheck aria-hidden="true" className="size-4" /> : <CircleAlert aria-hidden="true" className="size-4" />}
          {mileageOk ? messages.pmSummaryMileage(formatMileage(Number(mileage)))
            : mileageNeedsConfirmation ? messages.pmSummaryMileageConfirm
            : mileageBelowCurrent ? messages.pmSummaryMileageCheck : messages.pmSummaryMileageMissing}
        </span>
        <span aria-hidden="true" className="text-muted-foreground">·</span>
        <span className={`flex items-center gap-1.5 font-medium ${chosen ? 'text-success' : 'text-muted-foreground'}`}>
          {chosen ? <CircleCheck aria-hidden="true" className="size-4" /> : null}
          {messages.pmSummaryParts(chosen, usable.length)}
        </span>
        <span className="ml-auto text-xs" aria-live="polite">
          {saveStatus === 'saving' ? <span className="text-muted-foreground">{messages.saving}</span> : null}
          {saveStatus === 'saved' ? <span className="text-muted-foreground">{messages.autosaved}</span> : null}
          {saveStatus === 'error' ? <span className="font-medium text-destructive-text" data-testid="pm-not-saved">{onPhone ? messages.pmOnPhone(onPhone) : messages.pmNotSaved}</span> : null}
        </span>
      </div>
      {saveError ? (
        <p className="text-sm text-destructive-text" role="alert">
          {saveError}{' '}
          <Button variant="ghost" className="ml-1 px-2 underline" onClick={() => persist(draft)}>{messages.retry}</Button>
        </p>
      ) : null}

      {/* D53: on an iPad the mileage sits on the left and the parts on the right. */}
      <div className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
      <SectionCard title={messages.pmServiceLabel} titleId="pm-service-title">
        <div className="space-y-3 p-4">
          {/* UX-4-002: what is already known is text, not fields. */}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{messages.truckNowLabel}</dt>
              <dd className="font-semibold tnum" data-testid="pm-truck-now">{formatMileage(data.currentTruckMileage)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{messages.lastPmLabel}</dt>
              <dd className="font-semibold tnum">
                {!lastPm ? <span className="font-normal text-muted-foreground">{messages.noPmOnRecord}</span>
                  : lastPm.observedMileage === null ? messages.mileageNotRecorded
                  : <>{formatMileage(lastPm.observedMileage)} <span className="font-normal text-muted-foreground">· {dateOnly(lastPm.completedAt)}</span></>}
              </dd>
            </div>
          </dl>
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
                aria-invalid={showBelow || undefined}
                onBlur={() => { setMileageTouched(true); void persist(payloadFor(mileage, selections, jumpConfirmed)); }}
                onKeyDown={(event) => { if (event.key === 'Enter') setMileageTouched(true); }}
              />
              <span id="pm-observed-mileage-unit" className="text-sm text-muted-foreground">mi</span>
            </div>
            {samsara ? (
              <p className="mt-1.5 text-xs text-muted-foreground" data-testid="pm-samsara-reference">
                {messages.pmSamsaraReference(formatMileage(samsara.miles), formatAdminAgo(samsara.at, messages.locale))}
              </p>
            ) : null}
            {canEdit && samsara && samsaraGap !== null && !showBelow && !mileageNeedsConfirmation ? (
              <p className="mt-2 rounded-lg bg-warning-surface px-3 py-2 text-sm text-warning-foreground" role="status" data-testid="pm-samsara-gap">
                {messages.pmSamsaraGap(formatMileage(Math.abs(samsaraGap)), formatMileage(samsara.miles))}
              </p>
            ) : null}
            {showBelow && mileageCheck?.ok === false ? (
              <p className="mt-2 text-sm text-destructive-text" role="alert">
                {messages.mileageBelowCurrent(formatMileage(mileageCheck.currentMileage))}
              </p>
            ) : null}
            {mileageEmpty && data.observedMileage !== null ? (
              <p className="mt-2 text-sm text-muted-foreground" role="status">{messages.enterMileageToSave}</p>
            ) : null}
            {mileageNeedsConfirmation ? (
              <div className="mt-2 space-y-2 rounded-lg bg-warning-surface px-3 py-2 text-sm text-warning-foreground" role="alert">
                <p>{messages.mileageJumpWarning(formatMileage(currentTruckMileage))}</p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setJumpConfirmed(true);
                      persist(payloadFor(mileage, selections, true));
                    }}
                  >
                    {messages.confirmMileage}
                  </Button>
                  <Button variant="outline" className="bg-card" onClick={() => document.getElementById('pm-observed-mileage')?.focus()}>{messages.jumpFixIt}</Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={messages.partsUsed} count={chosen} action={<span className="text-xs text-muted-foreground">{messages.partsUsedHint}</span>}>
        {partsLocked && canEdit ? (
          <p className="border-b bg-warning-surface px-4 py-2 text-sm text-warning-foreground" id="pm-parts-locked">
            {mileageNeedsConfirmation ? messages.confirmMileageFirst : mileageEmpty && data.observedMileage !== null ? messages.enterMileageToSave : messages.enterMileageHint}
          </p>
        ) : null}
        <ul className="divide-y">
          {data.categories.map((category) => {
            const selected = selections[category.id] ?? '';
            const pending = pendingCategories.includes(category.id);
            const on = Boolean(selected) || pending;
            const noParts = category.parts.length === 0;
            const disabled = !canEdit || noParts || partsLocked;
            return (
              <li key={category.id} className={`space-y-2 px-4 py-3 ${on ? 'bg-success/5' : ''}`} data-testid={`pm-part-row-${category.slug}`}>
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${noParts ? 'text-muted-foreground' : ''}`}>{category.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {noParts ? messages.noCompatibleParts : on ? (selected ? category.parts.find((part) => part.id === selected)?.displayName : messages.chooseWhichPart) : messages.partNotChanged}
                    </span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={messages.partChangedSwitch(category.name)}
                    aria-describedby={partsLocked ? 'pm-parts-locked' : undefined}
                    disabled={disabled}
                    onClick={() => toggleCategory(category, !on)}
                    // UX-F-001: the button is 44 px tall on touch (gloves); the track inside keeps its 28 px look.
                    className="flex h-11 shrink-0 items-center disabled:opacity-40 lg:h-7"
                  >
                    {/* UX-2-005: the off track reaches 3:1 against the card (it was 1.5:1, the switch looked missing). */}
                    <span aria-hidden="true" className={`relative block h-7 w-12 rounded-full transition ${on ? 'bg-success' : 'bg-muted-foreground/75'}`}>
                      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
                    </span>
                  </button>
                </div>
                {on && !noParts ? (
                  <>
                    <Select
                      id={`pm-part-${category.id}`}
                      aria-label={category.name}
                      value={selected}
                      disabled={!canEdit || partsLocked}
                      onChange={(event) => setPart(category.id, event.target.value)}
                    >
                      <option value="">{messages.chooseWhichPart}</option>
                      {category.parts.map((part) => (
                        <option key={part.id} value={part.id}>
                          {part.partNumber ? `${part.partNumber} — ${part.displayName}` : part.displayName}
                        </option>
                      ))}
                    </Select>
                    {category.mostUsedPartId && selected === category.mostUsedPartId && category.pmCountForModel ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles aria-hidden="true" className="size-3.5" />{messages.mostUsedHint(category.mostUsedCount ?? 0, category.pmCountForModel)}</p>
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      </SectionCard>
      </div>
    </div>
  );
}

function CompletedPmSummary({ data }: { data: PmServiceDto }) {
  const { messages } = useShopLocale();
  const dateFormat = new Intl.DateTimeFormat(intlLocale(messages.locale), { dateStyle: 'medium', timeStyle: 'short' });
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
        <h2 id="pm-service-title" className="group-title">{messages.pmServiceLabel}</h2>
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
        <p className="group-title">{messages.partsUsed}</p>
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
