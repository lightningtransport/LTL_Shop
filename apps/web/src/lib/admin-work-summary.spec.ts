import { describe, expect, it } from 'vitest';
import { WorkOrderStatus } from '@ltl-shop/shared';
import { getAdminMessages } from './admin-messages';
import { mechanicNamesLabel, openCurrentWork } from './admin-work-summary';

describe('Admin work summaries (LTR-151)', () => {
  it('shows only an open Work Order as Truck current work', () => {
    for (const status of [WorkOrderStatus.CREATED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.WAITING_PAUSED]) {
      expect(openCurrentWork({ id: 'wo', status })).toEqual({ id: 'wo', status });
    }
    expect(openCurrentWork({ id: 'wo', status: WorkOrderStatus.COMPLETED })).toBeNull();
    expect(openCurrentWork({ id: 'wo', status: WorkOrderStatus.CANCELLED })).toBeNull();
    expect(openCurrentWork(null)).toBeNull();
  });

  it('uses "No mechanics assigned" for an empty mechanics list in both locales', () => {
    expect(mechanicNamesLabel([], getAdminMessages('en'))).toBe('No mechanics assigned');
    expect(mechanicNamesLabel([], getAdminMessages('es'))).toBe('No hay mecánicos asignados');
    expect(mechanicNamesLabel([{ mechanicName: 'Anthony' }, { mechanicName: 'Daniel' }], getAdminMessages('en'))).toBe('Anthony, Daniel');
  });
});
