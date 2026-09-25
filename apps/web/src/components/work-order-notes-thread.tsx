'use client';

import { useState } from 'react';
import { WorkOrderNoteKind, type WorkOrderDetailDto, type WorkOrderNoteDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { formatShopDateTime } from '@/lib/format';
import { useShopLocale } from '@/lib/locale-context';
import { useActionToast } from '@/components/action-toast';
import { Button, InlineAlert, Label, Textarea } from '@/components/ui';

/**
 * LTR-126 / D8: Work Order notes are append-only entries with author and time.
 * Nobody edits another person's note. "Request Work" sends the Manager a
 * structured request for additional work on the Truck.
 */
export function WorkOrderNotesThread({
  wo,
  onUpdated,
}: {
  wo: WorkOrderDetailDto;
  onUpdated: (updated: WorkOrderDetailDto) => Promise<void> | void;
}) {
  const { messages } = useShopLocale();
  const { showToast } = useActionToast();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<WorkOrderNoteKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closed = wo.status === 'completed' || wo.status === 'cancelled';
  const entries = wo.noteEntries ?? [];
  const inputId = `wo-notes-${wo.id}`;

  async function submit(kind: WorkOrderNoteKind) {
    const body = draft.trim();
    if (!body || pending) return;
    setPending(kind);
    setError(null);
    try {
      const updated = await apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ kind, body }),
      });
      setDraft('');
      await onUpdated(updated);
      showToast(
        'success',
        kind === WorkOrderNoteKind.WORK_REQUEST ? messages.workRequestSentSuccess : messages.noteAddedSuccess,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.unableToSaveNotes);
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="card mb-4 space-y-3" aria-labelledby={`${inputId}-title`}>
      <p id={`${inputId}-title`} className="section-label">{messages.notes}</p>
      {entries.length ? (
        <ul className="space-y-2">
          {entries.map((note) => (
            <NoteEntry key={note.id} note={note} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{messages.noteThreadEmpty}</p>
      )}
      {closed ? (
        <p className="text-sm text-muted-foreground">{messages.notesClosed}</p>
      ) : (
        <div className="space-y-2">
          <Label className="sr-only" htmlFor={inputId}>{messages.notes}</Label>
          <Textarea
            id={inputId}
            placeholder={messages.notePlaceholder}
            value={draft}
            maxLength={2000}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
          />
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!draft.trim() || pending !== null}
              onClick={() => void submit(WorkOrderNoteKind.NOTE)}
            >
              {pending === WorkOrderNoteKind.NOTE ? messages.saving : messages.addNote}
            </Button>
            <Button
              type="button"
              disabled={!draft.trim() || pending !== null}
              onClick={() => void submit(WorkOrderNoteKind.WORK_REQUEST)}
            >
              {pending === WorkOrderNoteKind.WORK_REQUEST ? messages.saving : messages.requestWork}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{messages.requestWorkHint}</p>
        </div>
      )}
    </section>
  );
}

function NoteEntry({ note }: { note: WorkOrderNoteDto }) {
  const { messages } = useShopLocale();
  const isRequest = note.kind === WorkOrderNoteKind.WORK_REQUEST;
  return (
    <li className={isRequest ? 'rounded-xl bg-warning-surface px-3 py-2 text-sm' : 'rounded-xl bg-muted px-3 py-2 text-sm'}>
      <p className="text-xs text-muted-foreground">
        {isRequest ? <span className="font-semibold text-warning-foreground">{messages.workRequestLabel} · </span> : null}
        {note.author.name} · {formatShopDateTime(note.createdAt, messages.locale)}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{note.body}</p>
      {isRequest ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {note.handledBy ? messages.workRequestHandledBy(note.handledBy.name) : messages.workRequestPending}
        </p>
      ) : null}
    </li>
  );
}
