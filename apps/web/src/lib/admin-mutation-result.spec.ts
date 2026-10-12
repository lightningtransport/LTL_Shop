import { describe, expect, it } from 'vitest';
import { workOrderDetailFromResult } from './admin-mutation-result';

const detail = {
  id: 'wo-1',
  displayId: 'WO-001',
  version: 4,
  status: 'in_progress',
  truck: { id: 't-1', truckNumber: 'Y-101' },
  jobs: [],
};

describe('workOrderDetailFromResult (PF2)', () => {
  it('accepts the Work Order the action changed, so the screen skips the refetch', () => {
    expect(workOrderDetailFromResult(detail, 'wo-1')).toBe(detail);
  });

  it('rejects another Work Order, so a Job action never overwrites the open one with a stranger', () => {
    expect(workOrderDetailFromResult({ ...detail, id: 'wo-2' }, 'wo-1')).toBeNull();
  });

  it('rejects answers that are not a detail (empty body, a note, an older API shape)', () => {
    expect(workOrderDetailFromResult(undefined, 'wo-1')).toBeNull();
    expect(workOrderDetailFromResult(null, 'wo-1')).toBeNull();
    expect(workOrderDetailFromResult({ id: 'wo-1', body: 'a note' }, 'wo-1')).toBeNull();
    expect(workOrderDetailFromResult({ ...detail, version: '4' }, 'wo-1')).toBeNull();
    expect(workOrderDetailFromResult({ ...detail, jobs: undefined }, 'wo-1')).toBeNull();
  });
});
