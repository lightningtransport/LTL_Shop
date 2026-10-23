import { describe, expect, it } from 'vitest';
import { orderJobs } from './work-order-jobs';

const job = (id: string, extra: Record<string, unknown> = {}) => ({
  id, status: 'to_do', category: { id: 'c', name: 'Brakes' }, displayName: id, helperOfJobId: null, external: null, ...extra,
}) as Parameters<typeof orderJobs>[0][number];

describe('Work Order Jobs order (D57 / LTR-301)', () => {
  it('groups by area; inside one the blocked first, then added order, then at an external shop; helpers under their Job', () => {
    const { open, groups, closed } = orderJobs([
      job('qc', { category: { id: 'q', name: 'Quality Check' }, displayName: 'Quality Check' }),
      job('detail', { area: 'detailing' }),
      job('out', { external: { kind: 'part', note: 'x' } }),
      job('a'),
      job('a-helper', { helperOfJobId: 'a' }),
      job('pm', { category: { id: 'p', name: 'PM' }, area: 'pm' }),
      job('tires', { category: { id: 't', name: 'Tires & Wheels' }, area: 'alignment' }),
      job('done', { status: 'completed' }),
      job('blocked'),
      job('gone', { status: 'cancelled' }),
    ], ['blocked']);
    expect(groups.map((group) => group.area)).toEqual(['pm', 'alignment', 'shop_work', 'detailing', 'quality_check']);
    expect(groups.map((group) => group.jobs.map((item) => item.id))).toEqual([['pm'], ['tires'], ['blocked', 'a', 'a-helper', 'out'], ['detail'], ['qc']]);
    expect(open.map((item) => item.id)).toEqual(['pm', 'tires', 'blocked', 'a', 'a-helper', 'out', 'detail', 'qc']);
    expect(closed.map((item) => item.id)).toEqual(['done', 'gone']);
  });

  it('an area with no open Jobs has no group', () => {
    expect(orderJobs([job('a'), job('x', { status: 'completed', area: 'pm' })]).groups.map((group) => group.area)).toEqual(['shop_work']);
  });
});
