import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api';
import { getAdminMessages } from '../lib/admin-messages';
import { pauseResumeError } from './pause-resume-error';

describe('pauseResumeError', () => {
  const en = getAdminMessages('en');
  const es = getAdminMessages('es');

  it('maps the pending-Jobs pause 400 to pause copy, not assignment copy', () => {
    const failure = new ApiError('A Work Order without pending jobs cannot be paused', 400, {
      message: 'A Work Order without pending jobs cannot be paused',
    });
    expect(pauseResumeError(failure, en)).toBe(en.pauseWorkOrderBadRequest);
    expect(pauseResumeError(failure, es)).toBe(es.pauseWorkOrderBadRequest);
    expect(pauseResumeError(failure, en)).not.toBe(en.assignmentBadRequest);
    expect(pauseResumeError(failure, es)).not.toBe(es.assignmentBadRequest);
  });

  it('maps the not-in-progress pause 400 to localized copy', () => {
    const failure = new ApiError('Only in-progress Work Orders can be paused', 400, {
      message: 'Only in-progress Work Orders can be paused',
    });
    expect(pauseResumeError(failure, en)).toBe(en.pauseWorkOrderNotInProgress);
    expect(pauseResumeError(failure, es)).toBe(es.pauseWorkOrderNotInProgress);
    expect(en.pauseWorkOrderNotInProgress).toMatch(/In Progress/);
    expect(es.pauseWorkOrderNotInProgress).toMatch(/En progreso/);
  });

  it('surfaces other pause 400 API messages', () => {
    const failure = new ApiError('Notes are required when reason is Other', 400, {
      message: 'Notes are required when reason is Other',
    });
    expect(pauseResumeError(failure, en)).toBe('Notes are required when reason is Other');
  });

  it('uses pause-specific generic copy for non-API failures', () => {
    expect(pauseResumeError(new Error('boom'), en)).toBe(en.pauseWorkOrderGenericError);
    expect(pauseResumeError(new Error('boom'), es)).toBe(es.pauseWorkOrderGenericError);
  });
});
