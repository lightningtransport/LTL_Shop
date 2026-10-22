'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Check, Download, RefreshCw, Send, Trash2, Undo2 } from 'lucide-react';
import { formatCents, type AdminInternalInvoiceDetailDto, type AdminInternalInvoiceLineDto } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { invoiceMonth, invoiceStatusChip } from './admin-internal-invoices';
import { AdminNavLink } from './admin-nav-link';
import { useAdminBreadcrumb, useDocumentTitle } from './admin-breadcrumb';
import { partsCostsFailure } from './admin-parts-catalog';
import { AdminBackLink, Badge, Button, DialogActions, EmptyState, InlineAlert, Label, LoadFailure, Modal, PageHeader, PageSkeleton, SectionCard, Textarea } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import {
  acceptAdminInternalInvoice,
  deleteAdminInternalInvoice,
  refreshAdminInternalInvoice,
  sendAdminInternalInvoice,
  setAdminInternalInvoiceLine,
  useAdminInternalInvoice,
  voidAdminInternalInvoice,
} from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ApiError } from '@/lib/api';
import { formatInvoiceDate } from '@/lib/parts-costs-format';
import { formatShortDateTime } from '@/lib/work-order-view';

const KIND_ORDER = ['part_purchase', 'outside_repair', 'labor'] as const;

function kindLabel(kind: string, messages: AdminMessages) {
  if (kind === 'outside_repair') return messages.pcCostsOutside;
  if (kind === 'labor') return messages.pcInvoiceLabor;
  return messages.pcCostsParts;
}

function sourceHref(line: AdminInternalInvoiceLineDto, from: string) {
  const back = `?from=${encodeURIComponent(from)}`;
  if (line.sourceType === 'part_purchase') return `/admin/parts/purchases/${line.sourceId}${back}`;
  if (line.sourceType === 'outside_repair') return `/admin/parts/outside-repairs/${line.sourceId}${back}`;
  if (line.sourceType === 'work_order_labor') return `/admin/work-orders/${line.sourceId}${back}`;
  // D45 / ST-3: a part taken from stock opens its Work Order.
  if ((line.sourceType === 'stock_issue' || line.sourceType === 'pm_oil_change') && line.workOrder) return `/admin/work-orders/${line.workOrder.id}${back}`;
  return null;
}

/**
 * LTR-201 / D34 (LB-2): one internal invoice. A draft shows its lines by kind (take one off, put it back, bring in
 * what is new), Send and Delete draft. A sent one is frozen: Download PDF (the print dialog → "Save as PDF"; the
 * printable page is the `#invoice-print` block), Mark accepted, Void.
 */
export function AdminInternalInvoiceDetail({ id, locale, messages }: { id: string; locale: AdminLocale; messages: AdminMessages }) {
  const router = useRouter();
  const canWrite = useCanShowManagerWrites();
  const { showToast } = useActionToast();
  const { data, error, isLoading, mutate } = useAdminInternalInvoice(id);
  const [dialog, setDialog] = useState<'send' | 'void' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // PCA11 (UX-5-006): "Internal invoices › SHOP-2026-0004" in the top bar and the tab.
  const crumbName = data ? data.number ?? fillPlaceholders(messages.pcInvoiceDraftLabel, { truck: data.truck.truckNumber, month: invoiceMonth(data.periodStart, locale) }) : null;
  useAdminBreadcrumb(crumbName ? [{ label: messages.pcInvoices, href: '/admin/parts/internal-invoices' }, { label: crumbName }] : null);
  useDocumentTitle(crumbName ? `${crumbName} — ${messages.pcInvoices}` : null);

  if (isLoading) return <PageSkeleton label={messages.pcInvoicesTitle} />;
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState><p>{messages.pcInvoiceNotFound}</p><Button asChild variant="outline" className="mt-4"><AdminNavLink href="/admin/parts/internal-invoices">{messages.pcInvoiceBackToList}</AdminNavLink></Button></EmptyState>;
  }
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  async function run(action: () => Promise<unknown>, toast: string, after?: () => void) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      if (toast) showToast('success', toast);
      setDialog(null);
      if (after) after();
      else void mutate();
    } catch (failure) {
      setActionError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  const draft = data.status === 'draft';
  const month = invoiceMonth(data.periodStart, locale);
  // PCA5 (UX-10-003): what comes from before the month (D34 carries the uncharged forward) is shown apart, not mixed in.
  const carried = data.lines.filter((line) => line.occurredOn < data.periodStart);
  const inPeriod = data.lines.filter((line) => line.occurredOn >= data.periodStart);
  const carriedCents = carried.reduce((sum, line) => sum + line.amountCents, 0);
  const carriedNotice = carried.length ? fillPlaceholders(messages.pcInvoiceCarriedNotice, { amount: formatCents(carriedCents, locale), month }) : null;
  const chip = invoiceStatusChip(data.status, messages);
  const title = data.number
    ? fillPlaceholders(messages.pcInvoiceTitle, { number: data.number, truck: data.truck.truckNumber, month })
    : fillPlaceholders(messages.pcInvoiceDraftTitle, { truck: data.truck.truckNumber, month });

  return (
    <div className="space-y-6">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #invoice-print, #invoice-print * { visibility: visible !important; }
        #invoice-print { display: block !important; position: absolute; inset: 0; padding: 32px; background: #fff; color: #000; }
      }`}</style>
      <AdminBackLink href="/admin/parts/internal-invoices">{messages.pcInvoiceBackToList}</AdminBackLink>
      <PageHeader
        title={title}
        badges={<Badge variant={chip.variant}>{chip.label}</Badge>}
        actions={canWrite ? (
          <div className="flex flex-wrap gap-2">
            {draft ? (
              <>
                <Button type="button" onClick={() => setDialog('send')} disabled={busy || !data.lines.length}><Send aria-hidden="true" />{messages.pcInvoiceSend}</Button>
                <Button type="button" variant="outline" onClick={() => setDialog('delete')} disabled={busy}><Trash2 aria-hidden="true" />{messages.pcInvoiceDeleteDraft}</Button>
              </>
            ) : null}
            {data.status === 'sent' || data.status === 'accepted' ? (
              <Button type="button" onClick={() => window.print()} title={messages.pcInvoiceDownloadHint}><Download aria-hidden="true" />{messages.pcInvoiceDownload}</Button>
            ) : null}
            {data.status === 'sent' ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => acceptAdminInternalInvoice(id), messages.pcInvoiceAcceptedToast)}><Check aria-hidden="true" />{messages.pcInvoiceAccept}</Button>
            ) : null}
            {data.status === 'sent' || data.status === 'accepted' ? (
              <Button type="button" variant="outline" onClick={() => setDialog('void')} disabled={busy}><Ban aria-hidden="true" />{messages.pcVoid}</Button>
            ) : null}
          </div>
        ) : null}
      />
      {actionError && !dialog ? <InlineAlert>{actionError}</InlineAlert> : null}

      {draft && data.availableCount ? (
        <p className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm" data-testid="invoice-available">
          {fillPlaceholders(messages.pcInvoiceNewAvailable, { count: String(data.availableCount) })}
          {canWrite ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run(() => refreshAdminInternalInvoice(id), messages.pcInvoiceRefresh)}><RefreshCw aria-hidden="true" />{messages.pcInvoiceRefresh}</Button>
          ) : null}
        </p>
      ) : null}

      <section className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto]" data-testid="invoice-summary">
        <div className="space-y-1 text-sm">
          <p><AdminNavLink className="tap-inline text-primary hover:underline" href={`/admin/trucks/${data.truck.id}?from=${encodeURIComponent(`/admin/parts/internal-invoices/${id}`)}&tab=costs`}>{fillPlaceholders(messages.pcTruckLabel, { truck: data.truck.truckNumber })}</AdminNavLink></p>
          <p><span className="text-muted-foreground">{messages.pcInvoicePrintPeriod}: </span>{formatInvoiceDate(data.periodStart, locale)} – {formatInvoiceDate(data.periodEnd, locale)}</p>
          {data.sentAt ? <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.pcInvoiceSentBy, { name: data.sentBy?.name ?? '—', date: formatShortDateTime(data.sentAt, locale) })}</p> : null}
          {data.acceptedAt ? <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.pcInvoiceAcceptedBy, { name: data.acceptedBy?.name ?? '—', date: formatShortDateTime(data.acceptedAt, locale) })}</p> : null}
          {data.voidedAt ? <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.pcVoidedBy, { name: data.voidedBy?.name ?? '—', date: formatShortDateTime(data.voidedAt, locale), reason: data.voidReason ?? '' })}</p> : null}
        </div>
        <Totals data={data} locale={locale} messages={messages} />
      </section>

      {carried.length ? (
        <SectionCard title={messages.pcInvoiceCarriedTitle} count={carried.length} data-testid="invoice-lines-carried">
          <p className="px-4 pt-3 text-xs text-muted-foreground">{fillPlaceholders(messages.pcInvoiceCarriedHint, { month })}</p>
          <LineList invoiceId={id} lines={carried} locale={locale} messages={messages} action={draft && canWrite ? { label: messages.pcInvoiceRemoveLine, icon: 'remove', run: (line) => void run(() => setAdminInternalInvoiceLine(id, line.id, false), messages.pcInvoiceRemoveLine) } : null} busy={busy} />
          <p className="flex justify-between border-t px-4 py-2 text-sm font-medium"><span>{messages.pcInvoiceCarriedTitle}</span><span className="tabular-nums" data-testid="invoice-carried-total">{formatCents(carriedCents, locale)}</span></p>
        </SectionCard>
      ) : null}
      {KIND_ORDER.map((kind) => {
        const lines = inPeriod.filter((line) => line.kind === kind);
        if (!lines.length) return null;
        return (
          <SectionCard key={kind} title={kindLabel(kind, messages)} count={lines.length} data-testid={`invoice-lines-${kind}`}>
            <LineList invoiceId={id} lines={lines} locale={locale} messages={messages} action={draft && canWrite ? { label: messages.pcInvoiceRemoveLine, icon: 'remove', run: (line) => void run(() => setAdminInternalInvoiceLine(id, line.id, false), messages.pcInvoiceRemoveLine) } : null} busy={busy} />
          </SectionCard>
        );
      })}
      {!data.lines.length ? <EmptyState><p>{messages.pcInvoiceEmptyLines}</p></EmptyState> : null}
      {data.removedLines.length ? (
        <SectionCard title={messages.pcInvoiceRemovedTitle} count={data.removedLines.length} data-testid="invoice-removed">
          <LineList invoiceId={id} lines={data.removedLines} locale={locale} messages={messages} muted action={canWrite ? { label: messages.pcInvoiceRestoreLine, icon: 'restore', run: (line) => void run(() => setAdminInternalInvoiceLine(id, line.id, true), messages.pcInvoiceRestoreLine) } : null} busy={busy} />
        </SectionCard>
      ) : null}

      <PrintableInvoice data={data} title={title} locale={locale} messages={messages} />

      {dialog === 'send' ? (
        <Modal open title={messages.pcInvoiceSendTitle} description={messages.pcInvoiceSendBody} onClose={() => setDialog(null)} closeLabel={messages.closeDialog}>
          {carriedNotice ? <InlineAlert className="mb-3" data-testid="invoice-send-carried">{carriedNotice}</InlineAlert> : null}
          {actionError ? <InlineAlert className="mb-3">{actionError}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>{messages.cancel}</Button>
            <Button loading={busy} type="button" onClick={() => void run(async () => {
              const sent = await sendAdminInternalInvoice(id);
              showToast('success', fillPlaceholders(messages.pcInvoiceSentToast, { number: sent.number }));
            }, '')}>{messages.pcInvoiceSend}</Button>
          </DialogActions>
        </Modal>
      ) : null}
      {dialog === 'delete' ? (
        <Modal open title={messages.pcInvoiceDeleteDraft} onClose={() => setDialog(null)} closeLabel={messages.closeDialog}>
          {actionError ? <InlineAlert className="mb-3">{actionError}</InlineAlert> : null}
          <DialogActions>
            <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>{messages.cancel}</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void run(() => deleteAdminInternalInvoice(id), messages.pcInvoiceDeleted, () => router.push('/admin/parts/internal-invoices'))}>{messages.pcInvoiceDeleteDraft}</Button>
          </DialogActions>
        </Modal>
      ) : null}
      {dialog === 'void' ? <VoidInvoiceDialog id={id} messages={messages} error={actionError} busy={busy} onClose={() => setDialog(null)} onVoid={(reason) => void run(() => voidAdminInternalInvoice(id, reason), messages.pcInvoiceVoidDone)} /> : null}
    </div>
  );
}

function Totals({ data, locale, messages }: { data: AdminInternalInvoiceDetailDto; locale: AdminLocale; messages: AdminMessages }) {
  return (
    <dl className="grid min-w-56 grid-cols-[1fr_auto] content-start gap-x-6 gap-y-1 rounded-lg bg-muted/60 px-4 py-3 text-sm" data-testid="invoice-totals">
      <dt className="text-muted-foreground">{messages.pcCostsParts}</dt><dd className="text-right tabular-nums">{formatCents(data.subtotals.partsCents, locale)}</dd>
      <dt className="text-muted-foreground">{messages.pcCostsOutside}</dt><dd className="text-right tabular-nums">{formatCents(data.subtotals.outsideCents, locale)}</dd>
      <dt className="text-muted-foreground">{messages.pcInvoiceLabor}</dt><dd className="text-right tabular-nums">{formatCents(data.subtotals.laborCents, locale)}</dd>
      <dt className="mt-1 border-t pt-1 text-base font-semibold">{messages.pcTotal}</dt>
      <dd className={`mt-1 border-t pt-1 text-right text-base font-semibold tabular-nums ${data.status === 'void' ? 'line-through' : ''}`} data-testid="invoice-total">{formatCents(data.totalCents, locale)}</dd>
    </dl>
  );
}

function LineList({ invoiceId, lines, locale, messages, action, busy, muted = false }: {
  invoiceId: string;
  lines: AdminInternalInvoiceLineDto[];
  locale: AdminLocale;
  messages: AdminMessages;
  action: { label: string; icon: 'remove' | 'restore'; run: (line: AdminInternalInvoiceLineDto) => void } | null;
  busy: boolean;
  muted?: boolean;
}) {
  return (
    <ul className="divide-y">
      {lines.map((line) => {
        const href = sourceHref(line, `/admin/parts/internal-invoices/${invoiceId}`);
        return (
          <li key={line.id} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm ${muted ? 'text-muted-foreground' : ''}`}>
            <span className="w-24 shrink-0 text-muted-foreground">{formatInvoiceDate(line.occurredOn, locale)}</span>
            <span className="min-w-0 flex-1">
              {href ? <AdminNavLink className="tap-inline hover:underline" href={href}>{line.description}</AdminNavLink> : line.description}
              {line.workOrder ? <span className="ml-2 font-mono text-xs text-muted-foreground">{line.workOrder.displayId}</span> : null}
              {/* PCA4 (UX-10-002): a credit that undoes something an earlier invoice charged says which one. */}
              {line.correctsInvoice?.number ? <span className="ml-2 text-xs text-muted-foreground" data-testid="invoice-line-corrects">{fillPlaceholders(messages.pcCorrectsInvoice, { number: line.correctsInvoice.number })}</span> : null}
            </span>
            <span className={`tabular-nums ${line.amountCents < 0 ? 'text-muted-foreground' : 'font-medium'}`}>{formatCents(line.amountCents, locale)}</span>
            {action ? (
              <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label={`${action.label}: ${line.description}`} onClick={() => action.run(line)}>
                {action.icon === 'remove' ? <Trash2 aria-hidden="true" /> : <Undo2 aria-hidden="true" />}{action.label}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The page Finance gets: hidden on screen, the only thing printed ("Save as PDF"). Black on white, any theme. */
function PrintableInvoice({ data, title, locale, messages }: { data: AdminInternalInvoiceDetailDto; title: string; locale: AdminLocale; messages: AdminMessages }) {
  return (
    <div id="invoice-print" className="hidden" aria-hidden="true">
      <p style={{ fontSize: 12 }}>{messages.pcInvoicePrintFrom}</p>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 12px' }}>{title}</h1>
      <p style={{ fontSize: 13 }}>{messages.pcInvoicePrintPeriod}: {formatInvoiceDate(data.periodStart, locale)} – {formatInvoiceDate(data.periodEnd, locale)}</p>
      {data.sentAt ? <p style={{ fontSize: 13 }}>{messages.pcInvoicePrintIssued}: {formatShortDateTime(data.sentAt, locale)}</p> : null}
      {/* PCA5 (UX-10-003): Finance sees what belongs to the month and what was carried over, apart. */}
      {[
        ...(data.lines.some((line) => line.occurredOn < data.periodStart) ? [{ key: 'carried', title: messages.pcInvoiceCarriedTitle, lines: data.lines.filter((line) => line.occurredOn < data.periodStart) }] : []),
        ...KIND_ORDER.map((kind) => ({ key: kind, title: kindLabel(kind, messages), lines: data.lines.filter((line) => line.kind === kind && line.occurredOn >= data.periodStart) })),
      ].map(({ key, title: sectionTitle, lines }) => {
        if (!lines.length) return null;
        return (
          <table key={key} style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 12 }}>
            <thead>
              <tr><th colSpan={3} style={{ textAlign: 'left', borderBottom: '1px solid #000', padding: '4px 0' }}>{sectionTitle}</th></tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td style={{ padding: '3px 8px 3px 0', whiteSpace: 'nowrap' }}>{formatInvoiceDate(line.occurredOn, locale)}</td>
                  <td style={{ padding: '3px 8px 3px 0' }}>{line.description}{line.workOrder ? ` · ${line.workOrder.displayId}` : ''}{line.correctsInvoice?.number ? ` · ${fillPlaceholders(messages.pcCorrectsInvoice, { number: line.correctsInvoice.number })}` : ''}</td>
                  <td style={{ padding: '3px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCents(line.amountCents, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
      <table style={{ marginTop: 20, marginLeft: 'auto', fontSize: 13 }}>
        <tbody>
          <tr><td style={{ paddingRight: 24 }}>{messages.pcCostsParts}</td><td style={{ textAlign: 'right' }}>{formatCents(data.subtotals.partsCents, locale)}</td></tr>
          <tr><td style={{ paddingRight: 24 }}>{messages.pcCostsOutside}</td><td style={{ textAlign: 'right' }}>{formatCents(data.subtotals.outsideCents, locale)}</td></tr>
          <tr><td style={{ paddingRight: 24 }}>{messages.pcInvoiceLabor}</td><td style={{ textAlign: 'right' }}>{formatCents(data.subtotals.laborCents, locale)}</td></tr>
          <tr><td style={{ paddingRight: 24, fontWeight: 700, borderTop: '1px solid #000' }}>{messages.pcTotal}</td><td style={{ textAlign: 'right', fontWeight: 700, borderTop: '1px solid #000' }}>{formatCents(data.totalCents, locale)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function VoidInvoiceDialog({ messages, error, busy, onClose, onVoid }: { id: string; messages: AdminMessages; error: string | null; busy: boolean; onClose: () => void; onVoid: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open title={messages.pcInvoiceVoidTitle} description={messages.pcInvoiceVoidBody} onClose={onClose} closeLabel={messages.closeDialog} dismissible={!reason.trim()}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (reason.trim()) onVoid(reason.trim()); }}>
        <div className="space-y-1.5">
          <Label htmlFor="invoice-void-reason">{messages.pcVoidReason}</Label>
          <Textarea id="invoice-void-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} />
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
