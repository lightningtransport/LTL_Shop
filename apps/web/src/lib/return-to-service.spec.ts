import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { getAdminMessages } from './admin-messages-catalog';
import { fillPlaceholders } from './admin-next-step';
import { returnToServiceErrorMessage } from './return-to-service';

describe('Return to Service dialog (D7 / UX-5-008)', () => {
  const en = getAdminMessages('en');
  const es = getAdminMessages('es');

  it('says what to do instead of a generic failure', () => {
    expect(returnToServiceErrorMessage(new ApiError('conflict', 409, null), en)).toBe(en.assignmentConflict);
    expect(returnToServiceErrorMessage(new ApiError('bad', 400, null), en)).toBe(en.returnToServiceBadRequest);
    expect(returnToServiceErrorMessage(new Error('network'), es)).toBe(es.returnToServiceGenericError);
  });

  it('names the Truck in both languages', () => {
    expect(fillPlaceholders(en.returnToServiceDialogTitle, { truck: '282' })).toBe('Return Truck 282 to service');
    expect(fillPlaceholders(es.returnToServiceDialogTitle, { truck: '282' })).toBe('Devolver el Truck 282 a servicio');
  });
});

describe('Truck header link to a completed Work Order (T1 / UX-5-001)', () => {
  it('does not call a completed Work Order "open"', () => {
    expect(fillPlaceholders(getAdminMessages('en').workPlanCompletedWorkOrder, { workOrder: 'WO-002' })).toBe('WO-002 · Completed');
    expect(fillPlaceholders(getAdminMessages('es').workPlanCompletedWorkOrder, { workOrder: 'WO-002' })).toBe('WO-002 · Completado');
  });
});
