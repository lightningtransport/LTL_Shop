import { ApiError } from './api';
import type { AdminMessages } from './admin-messages';

/**
 * Stage 2: the error a Manager can act on for a Next step action done in place (Dashboard, Truck,
 * Work Order) — a version conflict says reload, anything else falls back to the step's own message.
 */
export function workOrderActionErrorMessage(failure: unknown, messages: AdminMessages, fallback: string) {
  if (failure instanceof ApiError && failure.status === 409) return messages.assignmentConflict;
  return fallback;
}
