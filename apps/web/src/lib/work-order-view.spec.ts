import { describe, expect, it } from 'vitest';
import type { AdminWorkOrderDetailDto } from '@ltl-shop/shared';
import { correctedSegmentIds, formatAge, workOrderCancelReason, workOrderMechanics, workOrderProgress } from './work-order-view';

const job = (id: string, extra: Record<string, unknown> = {}) => ({ id, status: 'to_do', assignedMechanic: null, completedBy: null, external: null, ...extra });
const log = (extra: Record<string, unknown>) => ({ id: Math.random().toString(), eventType: 'manager_correction', entityType: 'x', entityId: null, user: { id: 'u', name: 'U' }, previousValue: null, newValue: null, relevantValue: null, createdAt: '2026-10-05T12:00:00.000Z', ...extra });

describe('Work Order view helpers (stage 8)', () => {
  it('progress counts done, blocked and external among the non-cancelled Jobs', () => {
    const data = {
      jobs: [job('a', { status: 'completed' }), job('b'), job('c', { external: { kind: 'part', note: 'x' } }), job('d', { status: 'cancelled' })],
      reportedBlockers: [{ id: 'x', resolvedAt: null, job: { id: 'b', displayName: 'B' } }, { id: 'y', resolvedAt: '2026-10-01', job: { id: 'c', displayName: 'C' } }],
    } as unknown as AdminWorkOrderDetailDto;
    expect(workOrderProgress(data)).toEqual({ done: 1, total: 3, blocked: 1, external: 1 });
  });

  it('the mechanics are the owners and finishers, once each', () => {
    const data = { jobs: [job('a', { assignedMechanic: { id: 'm1', name: 'Ana' } }), job('b', { completedBy: { id: 'm1', name: 'Ana' } }), job('c', { completedBy: { id: 'm2', name: 'Luis' } })] } as unknown as AdminWorkOrderDetailDto;
    expect(workOrderMechanics(data).map((person) => person.name)).toEqual(['Ana', 'Luis']);
  });

  it('age reads hours under a day, then days and hours', () => {
    const now = Date.parse('2026-10-05T12:00:00.000Z');
    expect(formatAge('2026-10-05T07:00:00.000Z', now)).toBe('5h');
    expect(formatAge('2026-10-01T10:00:00.000Z', now)).toBe('4d 2h');
  });

  it('reads the cancel reason and the corrected segments from the Activity Log', () => {
    const data = { activityLog: [
      log({ relevantValue: { action: 'work_order_cancelled', reason: 'Old' }, createdAt: '2026-10-01T00:00:00.000Z' }),
      log({ relevantValue: { action: 'work_order_cancelled', reason: 'Duplicate' }, createdAt: '2026-10-02T00:00:00.000Z' }),
      log({ entityId: 'seg-1', relevantValue: { action: 'time_corrected' } }),
    ] } as unknown as AdminWorkOrderDetailDto;
    expect(workOrderCancelReason(data)).toBe('Duplicate');
    expect([...correctedSegmentIds(data)]).toEqual(['seg-1']);
  });
});
