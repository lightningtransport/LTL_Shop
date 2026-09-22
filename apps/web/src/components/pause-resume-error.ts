import { ApiError } from '../lib/api';
import type { AdminMessages } from '../lib/admin-messages';

export function pauseResumeError(errorValue: unknown, messages: AdminMessages) {
  if (errorValue instanceof ApiError) {
    if (errorValue.status === 400) {
      const apiMessage = errorValue.message.trim();
      if (/without pending jobs cannot be paused/i.test(apiMessage)) {
        return messages.pauseWorkOrderBadRequest;
      }
      if (/only in-progress work orders can be paused/i.test(apiMessage)) {
        return messages.pauseWorkOrderNotInProgress;
      }
      return apiMessage || messages.pauseWorkOrderBadRequest;
    }
    if (errorValue.status === 409) return messages.assignmentConflict;
  }
  return messages.pauseWorkOrderGenericError;
}
