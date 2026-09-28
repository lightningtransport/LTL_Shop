import { describe, expect, it } from 'vitest';
import { WorkOrderStatus } from '@ltl-shop/shared';
import { getAdminMessages } from './admin-messages';
import { mechanicNamesLabel, openCurrentWork, workOrderNextJobLine } from './admin-work-summary';

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

describe('workOrderNextJobLine (LTR-157)', () => {
  const copy = { workOrderJobsNext: '{count} Jobs · Next: {job}', workOrderJobsAllDone: '{count} Jobs · all done' };
  const base = { category: { name: 'Inspection' }, jobsTotal: 5, jobsCompleted: 1 };

  it('says how many Jobs and which one is next instead of the Category', () => {
    expect(workOrderNextJobLine({ ...base, nextJobName: 'PM A Service' }, copy)).toBe('5 Jobs · Next: PM A Service');
    expect(workOrderNextJobLine({ ...base, jobsCompleted: 5, nextJobName: null }, copy)).toBe('5 Jobs · all done');
  });

  it('keeps the Category for legacy PM and for older API responses', () => {
    expect(workOrderNextJobLine({ ...base, category: { name: 'PM' }, nextJobName: 'x' }, copy)).toBe('PM');
    expect(workOrderNextJobLine(base, copy)).toBe('Inspection');
  });
});
