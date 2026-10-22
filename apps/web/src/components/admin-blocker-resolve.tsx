'use client';

import { useState } from 'react';
import { BlockerReason, type PauseEventDto } from '@ltl-shop/shared';
import { resolveAdminBlocker } from '@/lib/admin-data';
import { formatAdminDate } from '@/lib/admin-format';
import { adminPauseReasonLabel, type AdminLocale, type AdminMessages } from '@/lib/admin-messages';
import { fillPlaceholders } from '@/lib/admin-next-step';
import { useActionToast } from './action-toast';
import { RequiredNote, focusField } from './parts-costs-form-ui';
import { Button, Textarea } from './ui';

/**
 * LTR-155 / D17: one mechanic blocker as the Manager sees it — which Job, why,
 * who reported it and when, the mechanic's notes — with Resolve and an optional
 * note. Used on the Dashboard, the Truck and the Work Order detail.
 */
export function AdminBlockerResolve({
  noteOnDemand = false,
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
  /** Stage 3 (UX-4-002): the note box opens only after "Resolve", not always (Dashboard). */
  noteOnDemand?: boolean;
}) {
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { showToast } = useActionToast();
  const reason = adminPauseReasonLabel(blocker.blockerReason ?? blocker.reason, messages);
  const reporter = blocker.reportedBy?.name ?? blocker.createdBy?.name ?? messages.noValue;
  // LTR-217: resolving a Safety return without new work tells Safety why (the API asks for it too).
  const safetyReturn = blocker.blockerReason === BlockerReason.QUALITY_CHECK_FAILED;
  const noteLabel = safetyReturn ? messages.resolveSafetyReturnNoteLabel : messages.resolveBlockerNoteLabel;
  const noteMissing = safetyReturn && !note.trim();
  // LTR-293 §3: the button is on while the Safety note is empty; pressing it says the note is required right under
  // the box and goes there, instead of a grey button that never says why.
  const [showErrors, setShowErrors] = useState(false);
  const noteId = `blocker-note-${blocker.id}`;
  const noteBad = showErrors && noteMissing;

  async function resolve() {
    if (pending) return;
    if (noteMissing) {
      setShowErrors(true);
      focusField(noteId);
      return;
    }
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
        {/* LTR-164 (#9): a resolved blocker no longer reads "Blocked". */}
        {blocker.job
          ? fillPlaceholders(blocker.resolvedAt ? messages.resolvedJobReason : messages.blockedJobReason, { job: blocker.job.displayName, reason })
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
      ) : canResolve && noteOnDemand && !noteOpen ? (
        <div className="pt-1">
          <Button type="button" size="sm" onClick={() => setNoteOpen(true)}>{messages.resolveBlocker}</Button>
        </div>
      ) : canResolve && noteOnDemand ? (
        <form className="space-y-2 pt-1" onSubmit={(event) => { event.preventDefault(); void resolve(); }}>
          <Textarea
            id={noteId}
            aria-label={noteLabel}
            aria-invalid={noteBad || undefined}
            aria-describedby={noteBad ? `${noteId}-error` : undefined}
            placeholder={noteLabel}
            value={note}
            rows={2}
            maxLength={1000}
            disabled={pending}
            autoFocus
            onChange={(event) => setNote(event.target.value)}
          />
          <RequiredNote show={noteBad} id={`${noteId}-error`} messages={messages} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>{pending ? messages.saving : messages.blockerConfirmResolve}</Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setNoteOpen(false); setNote(''); setShowErrors(false); }}>{messages.cancel}</Button>
          </div>
        </form>
      ) : canResolve ? (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <Textarea
              id={noteId}
              aria-label={noteLabel}
              aria-invalid={noteBad || undefined}
              aria-describedby={noteBad ? `${noteId}-error` : undefined}
              placeholder={noteLabel}
              value={note}
              rows={1}
              maxLength={1000}
              disabled={pending}
              onChange={(event) => setNote(event.target.value)}
            />
            <RequiredNote show={noteBad} id={`${noteId}-error`} messages={messages} />
          </div>
          <Button type="button" size="sm" disabled={pending} onClick={() => void resolve()}>
            {safetyReturn ? messages.resolveSafetyReturnWithoutWork : messages.resolveBlocker}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
