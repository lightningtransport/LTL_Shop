import { describe, expect, it } from 'vitest';
import { isWorkOrderBlocked, workOrderAttentionRank, workOrderAttentionReason } from './attention';

const now = Date.parse('2026-09-25T12:00:00Z');
const base = {
  status: 'in_progress', priority: 'normal', categoryName: 'Engine', jobsCompleted: 1, jobsTotal: 2,
  hasActiveBlocker: false, createdAt: '2026-09-25T10:00:00Z',
};

describe('work order attention (LTR-121)', () => {
  it('ranks ready to close first, then priority, pause, blocker, age', () => {
    expect(workOrderAttentionReason({ ...base, jobsCompleted: 2, priority: 'critical' }, now)).toBe('ready_to_close');
    expect(workOrderAttentionReason({ ...base, priority: 'critical', status: 'waiting_paused' }, now)).toBe('critical');
    expect(workOrderAttentionReason({ ...base, priority: 'high', hasActiveBlocker: true }, now)).toBe('high');
    expect(workOrderAttentionReason({ ...base, status: 'waiting_paused', hasActiveBlocker: true }, now)).toBe('paused');
    expect(workOrderAttentionReason({ ...base, hasActiveBlocker: true }, now)).toBe('blocker');
    expect(workOrderAttentionReason({ ...base, createdAt: '2026-09-23T10:00:00Z' }, now)).toBe('open_over_24h');
    expect(workOrderAttentionReason(base, now)).toBe('open');
  });

  it('never marks PM or closed Work Orders ready to close', () => {
    // LTR-116: a fresh PM service is not "attention"; an old, paused or blocked one is.
    expect(workOrderAttentionReason({ ...base, categoryName: 'PM', jobsCompleted: 0, jobsTotal: 0 }, now)).toBeNull();
    expect(workOrderAttentionReason({ ...base, categoryName: 'PM', jobsCompleted: 0, jobsTotal: 0, createdAt: '2026-09-23T10:00:00Z' }, now)).toBe('open_over_24h');
    expect(workOrderAttentionReason({ ...base, categoryName: 'PM', jobsCompleted: 0, jobsTotal: 0, status: 'waiting_paused' }, now)).toBe('paused');
    expect(workOrderAttentionReason({ ...base, status: 'completed' }, now)).toBeNull();
  });

  it('orders reasons and treats pause or active blocker as Blocked', () => {
    expect(workOrderAttentionRank('ready_to_close')).toBeLessThan(workOrderAttentionRank('blocker'));
    expect(workOrderAttentionRank(null)).toBeGreaterThan(workOrderAttentionRank('open'));
    expect(isWorkOrderBlocked({ status: 'waiting_paused', hasActiveBlocker: false })).toBe(true);
    expect(isWorkOrderBlocked({ status: 'in_progress', hasActiveBlocker: true })).toBe(true);
    expect(isWorkOrderBlocked({ status: 'in_progress', hasActiveBlocker: false })).toBe(false);
  });
});
