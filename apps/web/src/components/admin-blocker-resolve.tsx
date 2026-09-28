'use client';

import { useState } from 'react';
import type { PauseEventDto } from '@ltl-shop/shared';
import { resolveAdminBlocker } from '@/lib/admin-data';
import { formatAdminDate } from '@/lib/admin-format';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { useActionToast } from './action-toast';
import { Button, Textarea } from './ui';

/**
 * LTR-155 / D17: one mechanic blocker as the Manager sees it — which Job, why,
 * who reported it and when, the mechanic's notes — with Resolve and an optional
 * note. Used on the Dashboard, the Truck and the Work Order detail.
 */
export function AdminBlockerResolve({
  workOrderId,
  blocker,
  locale,
  messages,
  canResolve,
  onResolved,
}: {
  workOrderId: string;
  blocker: PauseEventDto & { createdBy?: { id: string; name: string } };
  locale: AdminLocale;
  messages: AdminMessages;
  canResolve: boolean;
  onResolved: () => Promise<unknown> | void;
}) {
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const { showToast } = useActionToast();
  const reason = adminPauseReasonLabel(blocker.blockerReason ?? blocker.reason, messages);
  const reporter = blocker.reportedBy?.name ?? blocker.createdBy?.name ?? messages.noValue;

  async function resolve() {
    if (pending) return;
    setPending(true);
    try {
      await resolveAdminBlocker(workOrderId, blocker.id, note.trim() || undefined);
      setNote('');
      showToast('success', messages.blockerResolvedSuccess);
      await onResolved();
    } catch {
      showToast('error', messages.blockerResolveFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1 text-sm" data-testid="admin-blocker">
      <p className="font-medium">
        {blocker.job
          ? fillPlaceholders(messages.blockedJobReason, { job: blocker.job.displayName, reason })
          : reason}
      </p>
      <p className="text-muted-foreground">
        {fillPlaceholders(messages.reportedByAt, { name: reporter, date: formatAdminDate(blocker.startedAt, locale) })}
      </p>
      {blocker.notes ? <p>{blocker.notes}</p> : null}
      {(blocker.blockerNotes ?? []).map((entry) => (
        <p key={entry.id} className="text-muted-foreground">
          {fillPlaceholders(messages.blockerMechanicNote, {
            name: entry.author.name,
            date: formatAdminDate(entry.createdAt, locale),
            body: entry.body,
          })}
        </p>
      ))}
      {blocker.resolvedAt ? (
        <>
          <p className="text-xs text-muted-foreground">
            {fillPlaceholders(messages.blockerResolvedByAt, {
              name: blocker.resolvedBy?.name ?? messages.noValue,
              date: formatAdminDate(blocker.resolvedAt, locale),
            })}
          </p>
          {blocker.resolutionNote ? (
            <p className="text-xs text-muted-foreground">{fillPlaceholders(messages.blockerResolutionNote, { note: blocker.resolutionNote })}</p>
          ) : null}
        </>
      ) : canResolve ? (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-end">
          <Textarea
            aria-label={messages.resolveBlockerNoteLabel}
            placeholder={messages.resolveBlockerNoteLabel}
            value={note}
            rows={1}
            maxLength={1000}
            disabled={pending}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button type="button" size="sm" disabled={pending} onClick={() => void resolve()}>
            {messages.resolveBlocker}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
