'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban, Paperclip, Pencil } from 'lucide-react';
import { formatCents } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { AdminNavLink } from './admin-nav-link';
import { OutsideRepairForm } from './admin-outside-repair-form';
import { ChargedOnChips, chargedWarning } from './admin-charged-on';
import { InvoiceFileDialog } from './admin-invoice-file-dialog';
import { partsCostsFailure } from './admin-parts-catalog';
import { AdminBackLink, Badge, Button, DialogActions, EmptyState, InlineAlert, Label, LoadFailure, Modal, PageHeader, PageSkeleton, SectionCard, Textarea } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { openAdminAttachment, useAdminOutsideRepair, useAdminPurchaseFormData, useAdminVendors, voidAdminOutsideRepair } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { formatInvoiceDate } from '@/lib/parts-costs-format';
import { formatShortDateTime } from '@/lib/work-order-view';
import { adminPartsOrigin, adminTruckCostsHref } from '@/lib/admin-truck-origin';

/** LTR-200 / D32 (PC-3): one outside repair — truck, Job, amount, the invoice file, Edit and Void. */
export function AdminOutsideRepairDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
  const { showToast } = useActionToast();
  const { data, error, isLoading, mutate } = useAdminOutsideRepair(id);
  const { data: formData } = useAdminPurchaseFormData(canWrite);
  const { data: vendors } = useAdminVendors();
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [filing, setFiling] = useState(false);
  // PCA2 (UX-5-002): back to the Truck's costs, the Work Order, the invoice or the filtered list it was opened from.
  const from = useSearchParams().get('from');
  const origin = adminPartsOrigin(from, { href: '/admin/parts/outside-repairs', backLabel: messages.pcBackToOutside }, messages);
  const here = `/admin/parts/outside-repairs/${id}`;

  if (isLoading) return <PageSkeleton label={messages.pcOutsideTitle} />;
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState><p>{messages.pcOutsideNotFound}</p><Button asChild variant="outline" className="mt-4"><AdminNavLink href="/admin/parts/outside-repairs">{messages.pcBackToOutside}</AdminNavLink></Button></EmptyState>;
  }
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  async function openFile() {
    try {
      const { url } = await openAdminAttachment(data!.attachment!.id);
      window.open(url, '_blank', 'noopener');
    } catch {
      showToast('error', messages.pcFileOpenFailed);
    }
  }

  const live = !data.voidedAt;
  return (
    <div className="space-y-6">
      <AdminBackLink href={origin.href}>{origin.backLabel}</AdminBackLink>
      <PageHeader
        title={`${data.vendor.name} · ${data.invoiceNumber}`}
        subtitle={`${formatInvoiceDate(data.invoiceDate, locale)} · ${fillPlaceholders(messages.pcTruckLabel, { truck: data.truck.truckNumber })}`}
        badges={data.voidedAt ? <Badge variant="secondary">{messages.pcVoided}</Badge> : null}
        actions={canWrite && live ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!formData || !vendors} onClick={() => setEditing(true)}><Pencil aria-hidden="true" />{messages.pcEditOutside}</Button>
            <Button type="button" variant="outline" onClick={() => setVoiding(true)}><Ban aria-hidden="true" />{messages.pcVoid}</Button>
          </div>
        ) : null}
      />
      {data.voidedAt ? (
        <p className="rounded-xl border bg-muted px-4 py-3 text-sm" data-testid="outside-voided">
          {fillPlaceholders(messages.pcVoidedBy, { name: data.voidedBy?.name ?? '—', date: formatShortDateTime(data.voidedAt, locale), reason: data.voidReason ?? '' })}
        </p>
      ) : null}

      <SectionCard title={messages.pcWhatWasDone}>
        <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">{messages.pcWhatWasDone}</dt>
          <dd className="whitespace-pre-line">{data.description}</dd>
          <dt className="text-muted-foreground">{messages.pcTruckRequired}</dt>
          <dd><AdminNavLink className="tap-inline text-primary hover:underline" href={adminTruckCostsHref(data.truck.id, here)}>{fillPlaceholders(messages.pcTruckLabel, { truck: data.truck.truckNumber })}</AdminNavLink></dd>
          <dt className="text-muted-foreground">{messages.pcExternalJob}</dt>
          <dd data-testid="outside-job">
            {data.job
              ? <AdminNavLink className="tap-inline text-primary hover:underline" href={`/admin/work-orders/${data.job.workOrderId}?from=${encodeURIComponent(here)}`}>{data.job.displayName} · {data.job.workOrderDisplayId}{data.job.kind ? ` · ${data.job.kind === 'truck' ? messages.pcWhatTruck : messages.pcWhatPart}` : ''}</AdminNavLink>
              : <span className="text-muted-foreground">{messages.pcNotLinked}</span>}
          </dd>
          <dt className="text-muted-foreground">{messages.pcColAmount}</dt>
          <dd className={`font-semibold tabular-nums ${live ? '' : 'line-through'}`}>{formatCents(data.amountCents, locale)}</dd>
          {/* PCA4 (UX-10-002): whether Finance already has this on an invoice. */}
          <dt className="text-muted-foreground">{messages.pcChargedToFinance}</dt>
          <dd><ChargedOnChips chargedOn={data.chargedOn} from={here} messages={messages} testId="outside-charged-on" /></dd>
        </dl>
      </SectionCard>

      <SectionCard title={messages.pcInvoiceFile}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          {data.attachment ? (
            <>
              <Paperclip aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="min-w-0 truncate">{data.attachment.fileName}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void openFile()}>{messages.pcOpenFile}</Button>
            </>
          ) : <Badge variant="warning">{messages.pcNoInvoiceFile}</Badge>}
          {/* PCA6 (UX-10-004): the file on its own, without Edit. */}
          {canWrite && live && formData?.filesEnabled ? (
            <Button type="button" variant="ghost" size="sm" data-testid="outside-file-action" onClick={() => setFiling(true)}>{data.attachment ? messages.pcReplaceFile : messages.pcAddFile}</Button>
          ) : null}
        </div>
        {data.notes ? <p className="border-t px-4 py-3 text-sm whitespace-pre-line">{data.notes}</p> : null}
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          {fillPlaceholders(messages.pcLoadedBy, { name: data.createdBy?.name ?? '—', date: formatShortDateTime(data.createdAt, locale) })}
        </p>
      </SectionCard>

      {editing && formData && vendors ? (
        <OutsideRepairForm
          repair={data}
          vendors={vendors}
          formData={formData}
          locale={locale}
          messages={messages}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); void mutate(); }}
          notice={chargedWarning('edit', 'repair', data.chargedOn, messages)}
        />
      ) : null}
      {voiding ? <VoidRepairDialog id={data.id} warning={chargedWarning('void', 'repair', data.chargedOn, messages)} messages={messages} onClose={() => setVoiding(false)} onDone={() => { setVoiding(false); void mutate(); }} /> : null}
      {filing ? <InvoiceFileDialog owner="repair" id={data.id} current={data.attachment} messages={messages} onClose={() => setFiling(false)} onSaved={() => { setFiling(false); void mutate(); }} /> : null}
    </div>
  );
}

function VoidRepairDialog({ id, warning, messages, onClose, onDone }: { id: string; warning: string | null; messages: AdminMessages; onClose: () => void; onDone: () => void }) {
  const { showToast } = useActionToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await voidAdminOutsideRepair(id, reason.trim());
      showToast('success', messages.pcOutsideVoidDone);
      onDone();
    } catch (failure) {
      setError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title={messages.pcOutsideVoidTitle} description={messages.pcOutsideVoidBody} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!reason.trim()}>
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        {warning ? <InlineAlert data-testid="outside-void-charged">{warning}</InlineAlert> : null}
        <div className="space-y-1.5">
          <Label htmlFor="outside-void-reason">{messages.pcVoidReason}</Label>
          <Textarea id="outside-void-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} />
        </div>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <DialogActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" variant="destructive" disabled={busy || !reason.trim()}>{messages.pcVoid}</Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
