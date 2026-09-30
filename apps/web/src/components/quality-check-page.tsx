'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppCapability } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useShopLocale } from '@/lib/locale-context';
import { replaceAppLocation } from '@/lib/session-restore';
import { defaultWorkspacePath } from '@/lib/admin-routing';
import { formatVehicleYmm } from '@/lib/format';
import {
  relativeTime, useQualityCheckQueue, type QualityCheckItem, type QualityCheckQueue, type QualityCheckReturnedItem,
} from '@/lib/quality-check-data';
import { useActionToast } from './action-toast';
import { SessionSignInFallback } from './session-sign-in-fallback';
import {
  Badge, Button, Card, CardListSkeleton, EmptyState, HomeTopBar, InlineAlert, Label, LoadFailure, Modal, PageHeader, Textarea,
} from './ui';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** LTR-185 / D19: Safety takes a truck ready for Quality Check and approves it or returns it with a note. */
export function QualityCheckPage() {
  const { user, token, sessionLoading } = useAuth();
  const { messages } = useShopLocale();
  const { showToast } = useActionToast();
  const router = useRouter();
  const canPerform = !!user?.capabilities.includes(AppCapability.QUALITY_CHECK_PERFORM);
  const { data, error, mutate } = useQualityCheckQueue(!!token && canPerform);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [returning, setReturning] = useState<QualityCheckItem | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const returnTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!sessionLoading && !token) replaceAppLocation('/login', router);
    if (!sessionLoading && token && user && !canPerform) replaceAppLocation(defaultWorkspacePath(user), router);
  }, [sessionLoading, token, user, canPerform, router]);
  if (!sessionLoading && !token) return <SessionSignInFallback />;

  const t = messages.qc;
  const locale = messages.locale;

  async function run(item: QualityCheckItem, action: 'take' | 'approve' | 'return', body?: { notes: string }) {
    setBusy(`${item.workOrderId}:${action}`);
    setActionError(null);
    try {
      const next = await apiFetch<QualityCheckQueue>(`/api/qc/${item.workOrderId}/${action}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
      await mutate(next, { revalidate: false });
      if (action === 'take') showToast('success', t.takenToast(item.truck.truckNumber));
      if (action === 'approve') showToast('success', t.approved(item.truck.truckNumber));
      if (action === 'return') {
        showToast('success', t.returnedToast(item.truck.truckNumber));
        setReturning(null);
        setNote('');
      }
    } catch (caught) {
      setActionError(errorMessage(caught, t.loadError));
      void mutate();
    } finally {
      setBusy(null);
    }
  }

  const pending = data?.pending ?? [];
  const returned = data?.returned ?? [];

  return (
    <div>
      <HomeTopBar />
      <PageHeader className="mb-6" title={t.title} subtitle={t.subtitle} />
      {error ? <LoadFailure message={t.loadError} onRetry={() => void mutate()} retryLabel={messages.retry} /> : null}
      {actionError ? <InlineAlert className="mb-3">{actionError}</InlineAlert> : null}
      {!data && !error ? <CardListSkeleton /> : null}

      {data ? (
        <section aria-labelledby="qc-pending-title">
          <h2 id="qc-pending-title" className="mb-2 text-sm text-shop-muted">{t.pending(pending.length)}</h2>
          {!pending.length ? <EmptyState>{t.empty}</EmptyState> : null}
          <ul className="space-y-2">
            {pending.map((item) => {
              const takenByOther = item.takenBy && !item.mine;
              return (
                <li key={item.workOrderId}>
                  <Card className={item.mine ? 'border-primary p-3' : 'p-3'}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-display text-lg font-semibold">{messages.truckTitle(item.truck.truckNumber)}</p>
                      <p className="text-xs text-shop-muted">{item.displayId} · {t.readySince(relativeTime(item.readySince, locale))}</p>
                    </div>
                    {formatVehicleYmm(item.truck) ? <p className="text-sm text-shop-muted">{formatVehicleYmm(item.truck)}</p> : null}
                    <p className="mt-1 text-sm">{item.doneJobs.join(', ')}</p>
                    {item.mechanics.length ? <p className="text-xs text-shop-muted">{t.doneBy(item.mechanics.join(', '))}</p> : null}
                    {item.mine ? <Badge className="mt-2">{t.takenByMe}</Badge> : null}
                    {takenByOther ? <Badge variant="secondary" className="mt-2">{t.takenBy(item.takenBy!.name)}</Badge> : null}
                    <div className="mt-3 flex gap-2">
                      {item.mine ? (
                        <>
                          <Button className="flex-1" disabled={busy !== null} onClick={() => void run(item, 'approve')}>
                            {t.approve}
                          </Button>
                          <Button
                            ref={returnTriggerRef}
                            variant="outline"
                            className="flex-1"
                            disabled={busy !== null}
                            onClick={() => { setReturning(item); setNote(''); setNoteError(null); }}
                          >
                            {t.returnTruck}
                          </Button>
                        </>
                      ) : (
                        <Button className="flex-1" disabled={busy !== null || !!takenByOther} onClick={() => void run(item, 'take')}>
                          {t.take}
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <h2 className="mb-2 mt-6 text-sm text-shop-muted">{t.returned(returned.length)}</h2>
          {!returned.length ? <p className="text-sm text-shop-muted">{t.noneReturned}</p> : null}
          <ul className="space-y-2">
            {returned.map((item: QualityCheckReturnedItem) => (
              <li key={item.workOrderId}>
                <Card className="p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display text-lg font-semibold">{messages.truckTitle(item.truck.truckNumber)}</p>
                    <p className="text-xs text-shop-muted">{item.displayId} · {relativeTime(item.returnedAt, locale)}</p>
                  </div>
                  <p className="mt-1 text-sm">{t.returnedNote(item.note ?? '', item.returnedBy ?? '')}</p>
                  <Badge variant="secondary" className="mt-2">{t.waitingForManager}</Badge>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Modal
        open={Boolean(returning)}
        title={returning ? t.returnTitle(returning.truck.truckNumber) : t.returnTruck}
        closeLabel={messages.closeDialog}
        onClose={() => { if (!busy) setReturning(null); }}
        returnFocusRef={returnTriggerRef}
      >
        <p className="mb-3 text-sm text-shop-muted">{t.returnHint}</p>
        <Label className="mb-2 block" htmlFor="qc-return-note">{t.returnNoteLabel}</Label>
        <Textarea
          id="qc-return-note"
          value={note}
          placeholder={t.returnPlaceholder}
          disabled={busy !== null}
          onChange={(event) => { setNote(event.target.value); setNoteError(null); }}
        />
        {noteError ? <InlineAlert className="mt-2">{noteError}</InlineAlert> : null}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy !== null} onClick={() => setReturning(null)}>
            {messages.cancelAction}
          </Button>
          <Button
            className="flex-1"
            disabled={busy !== null}
            onClick={() => {
              if (!note.trim()) { setNoteError(t.returnNoteRequired); return; }
              if (returning) void run(returning, 'return', { notes: note.trim() });
            }}
          >
            {t.returnConfirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
