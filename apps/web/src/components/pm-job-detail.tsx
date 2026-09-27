'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { MechanicMode, type WorkOrderDetailDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { formatMileage } from '@/lib/format';
import { useShopLocale } from '@/lib/locale-context';
import { shopKeys, useCatalogJobs } from '@/lib/shop-data';
import { vehicleLine } from '@/lib/work-order-identity';
import { useActionToast } from './action-toast';
import { PmServiceCard, type PmDraftState } from './pm-service-card';
import { TruckInformationFields } from './truck-information-fields';
import { Button, InlineAlert, Label, Modal, ScreenHeader, Select, WorkspaceNav } from './ui';

/**
 * LTR-146: the PM mechanic's view of a truck Work Order — only its PM job.
 * Start the PM service, record mileage + parts, and finish the PM job. The
 * Work Order itself stays with the Standard team and the Shop Manager.
 */
export function PmJobDetail({
  wo,
  onUpdated,
}: {
  wo: WorkOrderDetailDto;
  onUpdated: (updated: WorkOrderDetailDto) => Promise<void>;
}) {
  const { messages } = useShopLocale();
  const { showToast } = useActionToast();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [draft, setDraft] = useState<PmDraftState>({
    ready: false, pending: false, hasError: false, observedMileage: '', selectedParts: 0,
  });
  const pmJob = wo.pmJob;
  const pmJobRow = wo.jobs.find((job) => job.id === pmJob?.id);
  const { data: pmServices } = useCatalogJobs(pmJobRow?.category.id ?? '', Boolean(pmJobRow) && pmJob?.status === 'to_do');
  const pmServiceOptions = (pmServices ?? []).filter((item) => /^PM [A-Z] Service$/i.test(item.displayName) || item.id === pmJobRow?.catalogJobId);
  if (!pmJob) return null;

  const started = Boolean(pmJob.startedAt);
  const finished = pmJob.status === 'completed';
  const mileage = Number(draft.observedMileage);
  const validMileage = draft.observedMileage.trim() !== '' && Number.isInteger(mileage) && mileage >= 0;
  const finishBlocked = busy || !draft.ready || draft.pending || draft.hasError || !validMileage || draft.selectedParts < 1;
  const mileageChangesTruck = validMileage && mileage !== wo.truck.mileage;

  async function run(action: () => Promise<WorkOrderDetailDto>, onSuccess?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      await onUpdated(updated);
      void mutate(shopKeys.pmService(wo.id));
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <WorkspaceNav mode={MechanicMode.PM} />
      <ScreenHeader
        title={messages.truckTitle(wo.truckNumber)}
        subtitle={[vehicleLine(wo.truck), messages.pmJobOnWorkOrder(pmJob.displayName, wo.displayId)].filter(Boolean).join(' · ')}
        backHref="/mechanic/pm"
      />
      {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}

      <section className="card mb-4 space-y-3" aria-labelledby="pm-job-truck-information">
        <h2 id="pm-job-truck-information" className="section-label">{messages.truckInformation}</h2>
        <TruckInformationFields truck={wo.truck} locale={messages.locale} />
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/trucks/${wo.truckId}/history?from=${encodeURIComponent(`/work-orders/${wo.id}`)}`}>
            {messages.repairHistory}
          </Link>
        </Button>
      </section>

      {/* LTR-148: PM A ↔ PM B before the PM service is finished. */}
      {!finished && pmJobRow && pmServiceOptions.length > 1 ? (
        <section className="card mb-4 space-y-2">
          <Label className="section-label" htmlFor="pm-job-service">{messages.pmServiceLabel}</Label>
          <Select
            id="pm-job-service"
            value={pmJobRow.catalogJobId ?? ''}
            disabled={busy}
            onChange={(event) => {
              const catalogJobId = event.target.value;
              if (!catalogJobId || catalogJobId === pmJobRow.catalogJobId) return;
              void run(() => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/jobs/${pmJob.id}/pm-service`, {
                method: 'POST',
                body: JSON.stringify({ catalogJobId }),
              }));
            }}
          >
            {pmServiceOptions.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </Select>
        </section>
      ) : null}

      {started ? (
        <PmServiceCard workOrderId={wo.id} onDraftStateChange={setDraft} />
      ) : (
        <section className="card mb-4 space-y-3">
          <p className="text-sm text-muted-foreground">{messages.pmJobNotStartedHint}</p>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => void run(
              () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/jobs/${pmJob.id}/pm/start`, { method: 'POST' }),
              () => showToast('success', messages.pmServiceStartedSuccess),
            )}
          >
            {busy ? messages.startingWork : messages.startPmService}
          </Button>
        </section>
      )}

      {finished ? (
        <p className="mb-4 rounded-xl bg-shop-success/10 px-3 py-2 text-sm text-shop-success">{messages.pmJobFinishedHint}</p>
      ) : started ? (
        <section className="mb-4 space-y-2" aria-label="PM job actions">
          <Button className="w-full" disabled={finishBlocked} onClick={() => setFinishOpen(true)}>{messages.finishWork}</Button>
          {finishBlocked ? <p className="text-sm text-muted-foreground">{messages.pmJobFinishRequirement}</p> : null}
        </section>
      ) : null}

      <Modal open={finishOpen} title={messages.finishWork} closeLabel={messages.closeDialog} onClose={() => { if (!busy) setFinishOpen(false); }}>
        {error ? <InlineAlert className="mb-3">{error}</InlineAlert> : null}
        <p className="mb-4 text-sm text-muted-foreground">
          {mileageChangesTruck
            ? `This will update the truck mileage from ${formatMileage(wo.truck.mileage)} to ${formatMileage(mileage)} and create an audit record.`
            : 'This will complete the PM service.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => { if (!busy) setFinishOpen(false); }}>{messages.cancelAction}</Button>
          <Button
            disabled={busy}
            onClick={() => void run(
              () => apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/jobs/${pmJob.id}/complete`, { method: 'POST', body: JSON.stringify({}) }),
              () => {
                setFinishOpen(false);
                showToast('success', messages.pmFinishedSuccess);
                router.replace('/mechanic/pm', { scroll: true });
              },
            )}
          >
            {busy ? messages.finishingWork : messages.finishWork}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
