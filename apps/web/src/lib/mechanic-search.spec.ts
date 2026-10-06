import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { getAdminMessages } from './admin-messages';
import { fillPlaceholders } from './admin-next-step';
import { filterPickerMechanics } from './mechanic-search';
import { workOrderActionErrorMessage } from './work-order-action-error';

describe('mechanic picker search (stage 2)', () => {
  const mechanics = [{ id: '1', name: 'Manuel García' }, { id: '2', name: 'Miguel Ángel' }, { id: '3', name: 'Luis Ramos' }];

  it('ignores case and accents', () => {
    expect(filterPickerMechanics(mechanics, 'garcia').map((m) => m.id)).toEqual(['1']);
    expect(filterPickerMechanics(mechanics, 'ÁNGEL').map((m) => m.id)).toEqual(['2']);
  });

  it('shows everyone with an empty search and nobody without a match', () => {
    expect(filterPickerMechanics(mechanics, '  ')).toHaveLength(3);
    expect(filterPickerMechanics(mechanics, 'zz')).toEqual([]);
  });
});

describe('Next step actions in place (stage 2)', () => {
  const en = getAdminMessages('en');

  it('a version conflict says reload; anything else keeps the step message', () => {
    expect(workOrderActionErrorMessage(new ApiError('conflict', 409, null), en, en.truckNextStepFailed)).toBe(en.assignmentConflict);
    expect(workOrderActionErrorMessage(new Error('x'), en, en.truckNextStepFailed)).toBe(en.truckNextStepFailed);
  });

  it('the close confirmation names the Work Order and the Truck, in both languages', () => {
    expect(fillPlaceholders(en.closeWorkOrderDialogBody, { workOrder: 'WO-004', truck: '601' }))
      .toBe('WO-004 closes as Completed and Truck 601 becomes Ready to Go. You can reopen it from the Work Order, with a reason.');
    expect(fillPlaceholders(getAdminMessages('es').closeWorkOrderDialogTitle, { workOrder: 'WO-004' })).toBe('¿Cerrar WO-004?');
  });
});
