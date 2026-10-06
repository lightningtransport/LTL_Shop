import { describe, expect, it } from 'vitest';
import { orderJobs } from './work-order-jobs';

const job = (id: string, extra: Record<string, unknown> = {}) => ({
  id, status: 'to_do', category: { id: 'c', name: 'Brakes' }, displayName: id, helperOfJobId: null, external: null, ...extra,
}) as Parameters<typeof orderJobs>[0][number];

describe('Work Order Jobs order (stage 5 / R3)', () => {
  it('blocked first, then the shop work, at an external shop, Quality Check last; helpers under their Job', () => {
    const { open, closed } = orderJobs([
      job('qc', { category: { id: 'q', name: 'Quality Check' }, displayName: 'Quality Check' }),
      job('out', { external: { kind: 'part', note: 'x' } }),
      job('a'),
      job('a-helper', { helperOfJobId: 'a' }),
      job('done', { status: 'completed' }),
      job('blocked'),
      job('gone', { status: 'cancelled' }),
    ], ['blocked']);
    expect(open.map((item) => item.id)).toEqual(['blocked', 'a', 'a-helper', 'out', 'qc']);
    expect(closed.map((item) => item.id)).toEqual(['done', 'gone']);
  });
});
