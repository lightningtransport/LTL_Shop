'use client';

import { useState } from 'react';
import { formatCents, parseMoneyToCents } from '@ltl-shop/shared';
import { useActionToast } from './action-toast';
import { partsCostsFailure } from './admin-parts-catalog';
import { Button, Card, CardContent, DataTable, InlineAlert, Input, Label, LoadFailure, PageHeader, PageSkeleton, SectionCard } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import { setAdminLaborRate, useAdminLaborRates } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { formatInvoiceDate } from '@/lib/parts-costs-format';

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * LTR-201 / D34 (LB-1): Parts & costs → Labor rate. One rate for the whole shop, from a date. Saving re-computes the
 * labor of completed Work Orders with work from that date (reversals in the ledger); earlier work keeps its rate.
 */
export function AdminLaborRate({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  const canWrite = useCanShowManagerWrites();
  const { showToast } = useActionToast();
  const { data, error, isLoading, mutate } = useAdminLaborRates();
  const [rate, setRate] = useState('');
  const [from, setFrom] = useState(today);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const cents = parseMoneyToCents(rate);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (typeof cents !== 'number' || !from || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const saved = await setAdminLaborRate({ rateCentsPerHour: cents, effectiveFrom: from });
      showToast('success', fillPlaceholders(messages.pcLaborRateSaved, { count: String(saved.recalculatedWorkOrders) }));
      setRate('');
      setShowErrors(false);
      void mutate();
    } catch (failure) {
      setSaveError(partsCostsFailure(failure, messages));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading && !data) return <PageSkeleton label={messages.pcLaborRate} />;
  if (error || !data) return <LoadFailure message={messages.loadError} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  return (
    <div className="space-y-6">
      <PageHeader title={messages.pcLaborRate} subtitle={messages.pcLaborRateSubtitle} />
      <Card className="p-4" data-testid="labor-rate-current">
        <CardContent>
          {data.current ? (
            <p className="text-lg font-semibold">
              {fillPlaceholders(messages.pcLaborRateCurrent, { rate: formatCents(data.current.rateCentsPerHour, locale), date: formatInvoiceDate(data.current.effectiveFrom, locale) })}
            </p>
          ) : <p className="text-sm text-muted-foreground">{messages.pcLaborRateNone}</p>}
        </CardContent>
      </Card>

      {canWrite ? (
        <SectionCard title={messages.pcLaborRateNew}>
          <form className="flex flex-wrap items-start gap-4 px-4 py-3" onSubmit={(event) => void submit(event)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="labor-rate">{messages.pcLaborRatePerHour}</Label>
              <div className="relative w-40">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">$</span>
                <Input id="labor-rate" className="pl-7 tabular-nums" inputMode="decimal" placeholder="0.00" value={rate} onChange={(event) => setRate(event.target.value)} disabled={busy} aria-invalid={cents === undefined || (showErrors && cents === null) || undefined} />
              </div>
              {cents === undefined ? <p className="text-xs text-destructive-text">{messages.pcCostInvalid}</p> : showErrors && cents === null ? <p className="text-xs text-destructive-text">{messages.pcLaborRateRequired}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="labor-rate-from">{messages.pcLaborRateFrom}</Label>
              <Input id="labor-rate-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={busy} />
            </div>
            <div className="flex min-w-60 flex-1 flex-col gap-2 pt-6">
              <p className="text-xs text-muted-foreground">{messages.pcLaborRateHelp}</p>
              {saveError ? <InlineAlert>{saveError}</InlineAlert> : null}
            </div>
            <div className="pt-6">
              <Button type="submit" disabled={busy}>{busy ? messages.pcSaving : messages.pcLaborRateSave}</Button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      {data.rates.length ? (
        <SectionCard title={messages.pcLaborRateHistory} count={data.rates.length}>
          <DataTable
            className="md:rounded-none md:border-0"
            items={data.rates}
            caption={messages.pcLaborRateHistory}
            getKey={(item) => item.id}
            getRowLabel={(item) => item.effectiveFrom}
            columns={[
              { key: 'from', header: messages.pcLaborRateColFrom, primary: true, cell: (item) => formatInvoiceDate(item.effectiveFrom, locale) },
              { key: 'rate', header: messages.pcLaborRateColRate, cell: (item) => <span className="tabular-nums">{formatCents(item.rateCentsPerHour, locale)}</span> },
              { key: 'by', header: messages.pcLaborRateColBy, cell: (item) => item.createdBy?.name ?? '—' },
            ]}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
