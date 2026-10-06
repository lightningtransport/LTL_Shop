import { ApiError } from './api';
import type { AdminMessages } from './admin-messages';

/** D7: the Return to Service error a Manager can act on — a conflict says reload, a rejected request says why. */
export function returnToServiceErrorMessage(failure: unknown, messages: AdminMessages) {
  if (failure instanceof ApiError) {
    if (failure.status === 409) return messages.assignmentConflict;
    if (failure.status === 400) return messages.returnToServiceBadRequest;
  }
  return messages.returnToServiceGenericError;
}
