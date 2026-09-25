import { describe, expect, it } from 'vitest';
import {
  canCompleteJob,
  canFinishWorkOrder,
  computeTotals,
  nextDisplayId,
  sessionDurationMs,
} from './work-order.timing';

describe('work-order.timing', () => {
  it('computes session duration from timestamps', () => {
    const start = new Date('2026-01-01T08:00:00Z');
    const end = new Date('2026-01-01T10:00:00Z');
    expect(sessionDurationMs(start, end)).toBe(2 * 60 * 60 * 1000);
  });

  it('computes active labor and waiting totals', () => {
    const totals = computeTotals({
      sessions: [
        {
          startedAt: new Date('2026-01-01T08:00:00Z'),
          endedAt: new Date('2026-01-01T10:00:00Z'),
        },
        {
          startedAt: new Date('2026-01-01T13:00:00Z'),
          endedAt: new Date('2026-01-01T15:00:00Z'),
        },
      ],
      pauses: [
        {
          startedAt: new Date('2026-01-01T10:00:00Z'),
          endedAt: new Date('2026-01-01T13:00:00Z'),
        },
      ],
    });
    expect(totals.totalActiveLaborMs).toBe(4 * 60 * 60 * 1000);
    expect(totals.totalWaitingMs).toBe(3 * 60 * 60 * 1000);
  });

  it('excludes report-only pause events from waiting totals', () => {
    const totals = computeTotals({
      sessions: [
        {
          startedAt: new Date('2026-01-01T08:00:00Z'),
          endedAt: new Date('2026-01-01T10:00:00Z'),
        },
      ],
      pauses: [
        {
          startedAt: new Date('2026-01-01T10:00:00Z'),
          endedAt: new Date('2026-01-01T13:00:00Z'),
          isOfficialPause: true,
        },
        {
          startedAt: new Date('2026-01-01T09:00:00Z'),
          endedAt: new Date('2026-01-01T12:00:00Z'),
          isOfficialPause: false,
        },
      ],
    });
    expect(totals.totalActiveLaborMs).toBe(2 * 60 * 60 * 1000);
    expect(totals.totalWaitingMs).toBe(3 * 60 * 60 * 1000);
  });

  it('requires resume before completing jobs while paused', () => {
    const result = canCompleteJob('waiting_paused');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('RESUME_REQUIRED');
  });

  it('requires start before completing jobs', () => {
    expect(canCompleteJob('created').code).toBe('START_REQUIRED');
  });

  it('blocks finish when jobs remain', () => {
    const result = canFinishWorkOrder([
      { status: 'completed' },
      { status: 'to_do' },
    ]);
    expect(result.ok).toBe(false);
  });

  it('allows finish when all jobs completed', () => {
    expect(
      canFinishWorkOrder([{ status: 'completed' }, { status: 'cancelled' }]).ok,
    ).toBe(true);
  });

  it('formats display ids', () => {
    expect(nextDisplayId(1)).toBe('WO-001');
    expect(nextDisplayId(42)).toBe('WO-042');
  });
});

describe('byPriorityThenOldest (LTR-129)', () => {
  it('puts Critical before Normal and keeps oldest first within a priority', async () => {
    const { byPriorityThenOldest } = await import('./work-orders.service');
    const rows = [
      { displayId: 'WO-004', priority: 'normal', createdAt: '2026-09-22T13:20:00.000Z' },
      { displayId: 'WO-003', priority: 'critical', createdAt: '2026-09-22T12:13:00.000Z' },
      { displayId: 'WO-010', priority: 'normal', createdAt: '2026-09-21T09:00:00.000Z' },
      { displayId: 'WO-011', priority: 'high', createdAt: '2026-09-23T09:00:00.000Z' },
    ];
    expect([...rows].sort(byPriorityThenOldest).map((row) => row.displayId))
      .toEqual(['WO-003', 'WO-011', 'WO-010', 'WO-004']);
  });
});
