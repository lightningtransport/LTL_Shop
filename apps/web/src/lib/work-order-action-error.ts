import { ApiError } from './api';
import type { AdminMessages } from './admin-messages';

/** The `code` an API refusal carries (`{ code, message }`), if any. */
export function apiErrorCode(failure: unknown): string | null {
  if (!(failure instanceof ApiError)) return null;
  const body = failure.body as { code?: unknown } | null;
  return typeof body?.code === 'string' ? body.code : null;
}

/**
 * Stage 2: the error a Manager can act on for a Next step action done in place (Dashboard, Truck,
 * Work Order) — a version conflict says reload, a rule of D55 says which one, anything else falls
 * back to the step's own message.
 */
export function workOrderActionErrorMessage(failure: unknown, messages: AdminMessages, fallback: string) {
  if (failure instanceof ApiError && failure.status === 409) return messages.assignmentConflict;
  switch (apiErrorCode(failure)) {
    case 'NOTHING_DONE': return messages.closeNothingDone;
    case 'QC_NOT_READY': return messages.qcNotReadyForManager;
    case 'QC_NOT_CANCELLABLE': return messages.qcNotCancellable;
    default: return fallback;
  }
}
