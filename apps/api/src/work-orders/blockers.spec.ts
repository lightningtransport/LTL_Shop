import { describe, expect, it, vi } from 'vitest';
import { resolveActiveBlockers } from './blockers';

function setup(blockers: Array<{ id: string; jobId: string | null }>) {
  const tx = {
    pauseEvent: {
      findMany: vi.fn().mockResolvedValue(blockers.map((b) => ({ ...b, blockerReason: 'waiting_for_parts', reason: null, notes: null }))),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const activity = { log: vi.fn().mockResolvedValue(undefined) };
  return { tx, activity };
}

describe('resolveActiveBlockers (LTR-176)', () => {
  it('resolves every active blocker of the Work Order and logs each one', async () => {
    const { tx, activity } = setup([{ id: 'b-1', jobId: 'j-1' }, { id: 'b-2', jobId: 'j-2' }]);
    const count = await resolveActiveBlockers(tx as never, activity as never, { workOrderId: 'wo', userId: 'mgr', note: 'Work Order cancelled.' });
    expect(count).toBe(2);
    expect(tx.pauseEvent.findMany).toHaveBeenCalledWith({ where: { workOrderId: 'wo', isOfficialPause: false, resolvedAt: null } });
    expect(tx.pauseEvent.update).toHaveBeenCalledTimes(2);
    expect(tx.pauseEvent.update).toHaveBeenCalledWith({ where: { id: 'b-1' }, data: { resolvedAt: expect.any(Date), resolvedById: 'mgr' } });
    expect(activity.log).toHaveBeenCalledWith(tx, expect.objectContaining({
      eventType: 'blocker_resolved', entityId: 'b-2', newValue: { resolved: true, actor: 'manager', notes: 'Work Order cancelled.' },
    }));
  });

  it('limits to one Job when asked and does nothing when the Job has no blocker', async () => {
    const { tx, activity } = setup([]);
    const count = await resolveActiveBlockers(tx as never, activity as never, { workOrderId: 'wo', jobId: 'j-1', userId: 'mgr', note: 'Job cancelled.' });
    expect(count).toBe(0);
    expect(tx.pauseEvent.findMany).toHaveBeenCalledWith({ where: { workOrderId: 'wo', isOfficialPause: false, resolvedAt: null, jobId: 'j-1' } });
    expect(tx.pauseEvent.update).not.toHaveBeenCalled();
    expect(activity.log).not.toHaveBeenCalled();
  });
});
