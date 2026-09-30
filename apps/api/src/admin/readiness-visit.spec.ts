import { describe, expect, it, vi } from 'vitest';
import { closeActiveAssessments, reopenAssessmentOfWorkOrder } from './readiness-visit';

const activity = () => ({ log: vi.fn().mockResolvedValue(undefined) });

describe('readiness per visit (LTR-177)', () => {
  it('closes every open assessment of the truck when a new Work Order starts', async () => {
    const tx = {
      truckReadinessAssessment: {
        findMany: vi.fn().mockResolvedValue([{ id: 'a-1', status: 'ready', version: 3 }]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const log = activity();
    const count = await closeActiveAssessments(tx as never, log as never, { truckId: 't', userId: 'mgr', reason: 'new_work_order' });
    expect(count).toBe(1);
    expect(tx.truckReadinessAssessment.update).toHaveBeenCalledWith({
      where: { id: 'a-1' },
      data: expect.objectContaining({ status: 'closed', closedById: 'mgr', closedReason: 'new_work_order' }),
    });
    expect(log.log).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: 'readiness_assessment_closed', entityId: 'a-1' }));
  });

  it('brings back the inspection of a cancelled visit when its Work Order is reopened', async () => {
    const tx = {
      truckReadinessAssessment: {
        findUnique: vi.fn().mockResolvedValue({ id: 'a-1', status: 'closed', version: 4, closedReason: 'work_order_cancelled' }),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const log = activity();
    await expect(reopenAssessmentOfWorkOrder(tx as never, log as never, { truckId: 't', assessmentId: 'a-1', userId: 'mgr', workOrderId: 'wo' })).resolves.toBe(true);
    expect(tx.truckReadinessAssessment.update).toHaveBeenCalledWith({
      where: { id: 'a-1' },
      data: expect.objectContaining({ status: 'under_review', closedReason: null }),
    });
  });

  it('leaves the assessment alone when another visit already started, or it was closed by Return to Service', async () => {
    const rts = {
      truckReadinessAssessment: {
        findUnique: vi.fn().mockResolvedValue({ id: 'a-1', status: 'closed', version: 4, closedReason: 'Returned to service' }),
        count: vi.fn(), update: vi.fn(),
      },
    };
    await expect(reopenAssessmentOfWorkOrder(rts as never, activity() as never, { truckId: 't', assessmentId: 'a-1', userId: 'mgr', workOrderId: 'wo' })).resolves.toBe(false);
    expect(rts.truckReadinessAssessment.update).not.toHaveBeenCalled();

    const busy = {
      truckReadinessAssessment: {
        findUnique: vi.fn().mockResolvedValue({ id: 'a-1', status: 'closed', version: 4, closedReason: 'work_order_cancelled' }),
        count: vi.fn().mockResolvedValue(1), update: vi.fn(),
      },
    };
    await expect(reopenAssessmentOfWorkOrder(busy as never, activity() as never, { truckId: 't', assessmentId: 'a-1', userId: 'mgr', workOrderId: 'wo' })).resolves.toBe(false);
    expect(busy.truckReadinessAssessment.update).not.toHaveBeenCalled();
    await expect(reopenAssessmentOfWorkOrder(busy as never, activity() as never, { truckId: 't', assessmentId: null, userId: 'mgr', workOrderId: 'wo' })).resolves.toBe(false);
  });
});
