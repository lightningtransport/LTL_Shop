'use client';

import { Button, InlineAlert } from './ui';
import type { AdminMessages } from '@/lib/admin-messages';

/** One thing missing before saving, and the field to send the person to. */
export type MissingField = { label: string; fieldId: string };

/**
 * UX-7-026 / PC1: after Save with something missing, say what — at the top of the form, in words — and go to the
 * first one. Each field also says "Required" next to it.
 */
export function MissingSummary({ missing, messages }: { missing: MissingField[]; messages: AdminMessages }) {
  if (!missing.length) return null;
  return (
    <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm" data-testid="form-missing">
      <p className="font-medium">{messages.pcMissingTitle}</p>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {missing.map((item) => (
          <li key={item.fieldId + item.label}>
            <button type="button" className="tap-inline underline underline-offset-2" onClick={() => focusField(item.fieldId)}>{item.label}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function focusField(fieldId: string) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.scrollIntoView({ block: 'center', behavior: 'smooth' });
  field.focus({ preventScroll: true });
}

/** "Required" under a field, only after a Save with it missing. */
export function RequiredNote({ show, messages }: { show: boolean; messages: AdminMessages }) {
  return show ? <p className="text-xs text-destructive-text">{messages.pcFieldRequired}</p> : null;
}

/** A label for a field that may stay empty: "Tax (optional)". */
export function OptionalTag({ messages }: { messages: AdminMessages }) {
  return <span className="font-normal text-muted-foreground"> ({messages.pcOptional})</span>;
}

/**
 * UX-7-029 / PC4: the form's buttons stay at the bottom of the dialog, always in view. Closing with changes asks
 * right there, in place of the buttons, instead of at the end of a long form.
 */
export function StickyFormFooter({
  error,
  confirmDiscard,
  onDiscard,
  onKeepEditing,
  onCancel,
  submitLabel,
  submitDisabled,
  busy,
  messages,
}: {
  error: string | null;
  confirmDiscard: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
  onCancel: () => void;
  submitLabel: string;
  submitDisabled: boolean;
  busy: boolean;
  messages: AdminMessages;
}) {
  return (
    <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 space-y-2 border-t bg-card px-5 pb-[calc(1.25rem+var(--app-safe-bottom))] pt-3 sm:pb-5" data-testid="form-footer">
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      {confirmDiscard ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm" role="alertdialog" aria-label={messages.pcDiscardTitle}>
          <div>
            <p className="font-medium">{messages.pcDiscardTitle}</p>
            <p className="text-muted-foreground">{messages.pcDiscardBody}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onKeepEditing} autoFocus>{messages.pcKeepEditing}</Button>
            <Button type="button" variant="destructive" onClick={onDiscard}>{messages.pcDiscard}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{messages.cancel}</Button>
          <Button type="submit" disabled={submitDisabled}>{busy ? messages.pcSaving : submitLabel}</Button>
        </div>
      )}
    </div>
  );
}
