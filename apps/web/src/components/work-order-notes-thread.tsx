'use client';

import { useState } from 'react';
import { Send, Wrench } from 'lucide-react';
import { WorkOrderNoteKind, type WorkOrderDetailDto, type WorkOrderNoteDto } from '@ltl-shop/shared';
import { apiFetch } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error-message';
import { draftKeys, useLocalDraft } from '@/lib/local-draft';
import { formatShopDateTime } from '@/lib/format';
import { useShopLocale } from '@/lib/locale-context';
import { useActionToast } from '@/components/action-toast';
import { MechanicAvatar } from '@/components/mechanic-avatar';
import { Button, DialogActions, InlineAlert, Label, Modal, SectionCard, Textarea } from '@/components/ui';

/**
 * LTR-126 / D8: Work Order notes are append-only entries with author and time.
 * Nobody edits another person's note. Stage MG-4 (UX-7-006, UX-7-001): a note and a work request are two
 * entries — the note field has its own label, and "Request work" opens its own sheet that says it goes to
 * the Manager. Both drafts stay on the phone until they are sent (block A, PM6).
 */
export function WorkOrderNotesThread({
  wo,
  onUpdated,
}: {
  wo: WorkOrderDetailDto;
  onUpdated: (updated: WorkOrderDetailDto) => Promise<void> | void;
}) {
  const { messages } = useShopLocale();
  const { showToast, dismissToast } = useActionToast();
  // Block A (PM6, MG9): an unsent note stays on this phone until it is posted; it is published with the button.
  const [draft, setDraft, clearDraft] = useLocalDraft(draftKeys.workOrderNote(wo.id));
  const [requestOpen, setRequestOpen] = useState(false);
  const [request, setRequest, clearRequest] = useLocalDraft(draftKeys.workRequest(wo.id));
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState<WorkOrderNoteKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closed = wo.status === 'completed' || wo.status === 'cancelled';
  const entries = wo.noteEntries ?? [];
  const inputId = `wo-notes-${wo.id}`;

  async function submit(kind: WorkOrderNoteKind) {
    const body = (kind === WorkOrderNoteKind.WORK_REQUEST ? request : draft).trim();
    if (pending) return;
    if (!body) {
      if (kind === WorkOrderNoteKind.WORK_REQUEST) setRequestError(messages.requestWorkRequired);
      return;
    }
    setPending(kind);
    setError(null);
    setRequestError(null);
    try {
      const updated = await apiFetch<WorkOrderDetailDto>(`/api/work-orders/${wo.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ kind, body }),
      });
      if (kind === WorkOrderNoteKind.WORK_REQUEST) {
        clearRequest();
        setRequestOpen(false);
      } else {
        clearDraft();
      }
      await onUpdated(updated);
      showToast(
        'success',
        kind === WorkOrderNoteKind.WORK_REQUEST ? messages.workRequestSentSuccess : messages.noteAddedSuccess,
      );
    } catch (err) {
      // Block A (MG7): the API's English text never reaches a Spanish screen.
      const message = apiErrorMessage(err, messages, messages.unableToSaveNotes);
      if (kind === WorkOrderNoteKind.WORK_REQUEST) setRequestError(message);
      else setError(message);
    } finally {
      setPending(null);
    }
  }

  return (
    <SectionCard
      className="mb-4"
      title={messages.notes}
      count={entries.length || null}
      titleId={`${inputId}-title`}
      action={closed ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { dismissToast(); setRequestError(null); setRequestOpen(true); }}
        >
          <Wrench aria-hidden="true" />{messages.requestWork}
        </Button>
      )}
    >
      {entries.length ? (
        <ul className="divide-y">
          {entries.map((note) => (
            <NoteEntry key={note.id} note={note} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">{messages.noteThreadEmpty}</p>
      )}
      {closed ? (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">{messages.notesClosed}</p>
      ) : (
        <div className="space-y-2 border-t px-4 py-3">
          <Label htmlFor={inputId}>{messages.addANoteLabel}</Label>
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{messages.notesKeptHint}</p>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={!draft.trim() || pending !== null}
              onClick={() => void submit(WorkOrderNoteKind.NOTE)}
            >
              <Send aria-hidden="true" />
              {pending === WorkOrderNoteKind.NOTE ? messages.saving : messages.addNote}
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={requestOpen}
        title={messages.requestWorkTitle}
        description={messages.requestWorkSheetHint}
        closeLabel={messages.closeDialog}
        onClose={() => { if (!pending) { setRequestOpen(false); setRequestError(null); } }}
      >
        <Label className="mb-2 block" htmlFor={`${inputId}-request`}>{messages.requestWork}</Label>
        <Textarea
          id={`${inputId}-request`}
          value={request}
          maxLength={2000}
          aria-invalid={requestError ? true : undefined}
          onChange={(event) => { setRequest(event.target.value); setRequestError(null); }}
        />
        {requestError ? <p className="mt-2 text-sm text-destructive-text" role="alert">{requestError}</p> : null}
        <DialogActions className="mt-4">
          <Button variant="outline" disabled={pending !== null} onClick={() => setRequestOpen(false)}>{messages.cancelAction}</Button>
          <Button disabled={pending !== null} onClick={() => void submit(WorkOrderNoteKind.WORK_REQUEST)}>
            <Send aria-hidden="true" />
            {pending === WorkOrderNoteKind.WORK_REQUEST ? messages.saving : messages.requestWorkSend}
          </Button>
        </DialogActions>
      </Modal>
    </SectionCard>
  );
}

function NoteEntry({ note }: { note: WorkOrderNoteDto }) {
  const { messages } = useShopLocale();
  const isRequest = note.kind === WorkOrderNoteKind.WORK_REQUEST;
  return (
    <li className="flex gap-3 px-4 py-3 text-sm">
      <MechanicAvatar id={note.author.id} name={note.author.name} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          <b className="font-semibold text-foreground">{note.author.name}</b> {formatShopDateTime(note.createdAt, messages.locale)}
        </p>
        {isRequest ? (
          <p className="mt-1 inline-flex rounded-md bg-warning-surface px-1.5 py-px text-xs font-semibold text-warning-foreground">{messages.workRequestLabel}</p>
        ) : null}
        <p className="mt-1 whitespace-pre-wrap text-foreground">{note.body}</p>
        {isRequest ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {note.handledBy ? messages.workRequestHandledBy(note.handledBy.name) : messages.workRequestPending}
          </p>
        ) : null}
      </div>
    </li>
  );
}
