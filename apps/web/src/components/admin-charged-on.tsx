'use client';

import type { AdminChargedOnDto } from '@ltl-shop/shared';
import { AdminNavLink } from './admin-nav-link';
import { invoiceStatusChip } from './admin-internal-invoices';
import { Badge } from './ui';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminMessages } from '@/lib/admin-messages';

/**
 * PCA4 (UX-10-002): which internal invoices to Finance already charge a purchase, a repair or one ledger row.
 * "Not charged yet" is said out loud, because that is what decides whether a correction is free or lands on the
 * next invoice as a credit.
 */
export function ChargedOnChips({ chargedOn, from, messages, testId }: { chargedOn: AdminChargedOnDto[] | undefined; from: string; messages: AdminMessages; testId?: string }) {
  const list = chargedOn ?? [];
  if (!list.length) return <span className="text-muted-foreground" data-testid={testId}>{messages.pcNotChargedYet}</span>;
  return (
    <span className="flex flex-wrap gap-1.5" data-testid={testId}>
      {list.map((invoice) => <ChargedOnChip key={invoice.id} invoice={invoice} from={from} messages={messages} />)}
    </span>
  );
}

export function ChargedOnChip({ invoice, from, messages }: { invoice: AdminChargedOnDto; from: string; messages: AdminMessages }) {
  const chip = invoiceStatusChip(invoice.status, messages);
  const label = invoice.number ? fillPlaceholders(messages.pcChargedOn, { number: invoice.number, status: chip.label }) : messages.pcChargedOnDraft;
  return (
    <AdminNavLink href={`/admin/parts/internal-invoices/${invoice.id}?from=${encodeURIComponent(from)}`} className="tap-inline no-underline">
      <Badge variant={chip.variant}>{label}</Badge>
    </AdminNavLink>
  );
}

/** The sentence that goes above Edit or Void when the record is already on a sent or accepted invoice. */
export function chargedWarning(kind: 'edit' | 'void', record: 'purchase' | 'repair', chargedOn: AdminChargedOnDto[] | undefined, messages: AdminMessages): string | null {
  const sent = (chargedOn ?? []).filter((invoice) => invoice.status === 'sent' || invoice.status === 'accepted');
  if (!sent.length) return null;
  return fillPlaceholders(kind === 'edit' ? messages.pcChargedEditWarning : messages.pcChargedVoidWarning, {
    record: record === 'purchase' ? messages.pcRecordPurchase : messages.pcRecordRepair,
    invoices: sent.map((invoice) => invoice.number ?? '').filter(Boolean).join(', '),
  });
}
