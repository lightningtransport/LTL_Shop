import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AppCapability,
  JobStatus,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  UserRole,
  WorkOrderStatus,
  WorkPlanInspectionOutcome,
  WorkPlanNotReadyReason,
  WorkPlanPhase,
} from '@ltl-shop/shared';
import { YardWorkPlanService, childIdempotencyKey } from './yard-work-plan.service';

const truckId = '00000000-0000-4000-8000-000000000001';
const workOrderId = '00000000-0000-4000-8000-000000000002';
const categoryId = '00000000-0000-4000-8000-000000000003';
const idempotencyKey = '00000000-0000-4000-8000-000000000010';

const manager = {
  id: '00000000-0000-4000-8000-000000000099',
  email: 'manager@example.com',
  name: 'Manager',
  role: UserRole.MANAGER,
  active: true,
  capabilities: [
    AppCapability.ADMIN_ACCESS,
    AppCapability.WORK_ORDERS_MANAGE,
    AppCapability.YARD_OPERATIONS_MANAGE,
  ],
  supabaseAuthId: null,
};

function openWorkOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: workOrderId,
    displayId: 'WO-1',
    status: WorkOrderStatus.CREATED,
    version: 3,
    idempotencyKey: null,
    primaryCategory: { id: categoryId, name: 'Air & Brake System' },
    jobs: [{
      id: '00000000-0000-4000-8000-000000000021',
      catalogJobId: null,
      displayName: 'Brake Inspection',
      customDescription: null,
      status: JobStatus.TO_DO,
      category: { id: categoryId, name: 'Air & Brake System' },
    }],
    ...overrides,
  };
}

describe('YardWorkPlanService', () => {
  it('reads the open Work Order jobs and reports Shop Work as Not Ready', async () => {
    const prisma = {
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      workOrder: { findFirst: vi.fn().mockResolvedValue(openWorkOrder()) },
      truckReadinessAssessment: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new YardWorkPlanService(prisma as never, {} as never, {} as never);
    const plan = await service.get(manager, truckId);
    expect(plan.workOrder?.id).toBe(workOrderId);
    expect(plan.jobs).toHaveLength(1);
    expect(plan.phase).toBe(WorkPlanPhase.SHOP_WORK);
    expect(plan.remainingJobCount).toBe(1);
    expect(plan.readyReason).toBe(WorkPlanNotReadyReason.JOBS_REMAINING);
    expect(plan.phase1.gatesRemainDefault).toBe(true);
    expect(plan.capabilities.canAddWork).toBe(true);
  });

  it('Stage 8: sends when the inspection was recorded, when each Job was done, and the Work Order priority', async () => {
    const recordedAt = new Date('2026-10-04T13:12:00.000Z');
    const doneAt = new Date('2026-10-04T19:10:00.000Z');
    const prisma = {
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      workOrder: { findFirst: vi.fn().mockResolvedValue(openWorkOrder({
        priority: 'high',
        completedAt: null,
        jobs: [{
          id: '00000000-0000-4000-8000-000000000021', catalogJobId: null, displayName: 'Brake Inspection', customDescription: null,
          status: JobStatus.COMPLETED, completedAt: doneAt, category: { id: categoryId, name: 'Air & Brake System' },
        }],
      })) },
      truckReadinessAssessment: { findFirst: vi.fn().mockResolvedValue({
        id: 'a1',
        requirements: [{ type: ReadinessRequirementType.INSPECTION, outcome: ReadinessRequirementOutcome.REQUIRED, evaluatedAt: recordedAt }],
      }) },
    };
    const service = new YardWorkPlanService(prisma as never, {} as never, {} as never);
    const plan = await service.get(manager, truckId);
    expect(plan.inspection).toEqual({ outcome: WorkPlanInspectionOutcome.ISSUES_FOUND, recordedAt: recordedAt.toISOString() });
    expect(plan.jobs[0].completedAt).toBe(doneAt.toISOString());
    expect(plan.workOrder).toMatchObject({ priority: 'high', completedAt: null });
  });

  it('creates a Standard Work Order when the Truck has none', async () => {
    const prisma = {
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      workOrder: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(openWorkOrder()),
      },
      truckReadinessAssessment: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const workOrders = { createByManager: vi.fn().mockResolvedValue({ id: workOrderId, version: 1 }) };
    const service = new YardWorkPlanService(prisma as never, workOrders as never, {} as never);
    const plan = await service.addJobs(manager, truckId, {
      idempotencyKey,
      jobs: [{ categoryId, displayName: 'Brake Inspection' }],
    });
    expect(workOrders.createByManager).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        truckId,
        primaryCategoryId: categoryId,
        idempotencyKey,
      }),
    );
    expect(plan.workOrder?.id).toBe(workOrderId);
  });

  it('adds jobs to the existing open Work Order through the manager add-job path', async () => {
    const prisma = {
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      workOrder: { findFirst: vi.fn().mockResolvedValue(openWorkOrder()) },
      workOrderMutation: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      truckReadinessAssessment: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const workOrders = {
      addJobByManager: vi.fn().mockResolvedValue({ version: 4 }),
    };
    const service = new YardWorkPlanService(prisma as never, workOrders as never, {} as never);
    await service.addJobs(manager, truckId, {
      idempotencyKey,
      expectedVersion: 3,
      jobs: [{ categoryId, displayName: 'Air Leak' }],
    });
    expect(workOrders.addJobByManager).toHaveBeenCalledWith(
      manager,
      workOrderId,
      expect.objectContaining({
        displayName: 'Air Leak',
        expectedVersion: 3,
        idempotencyKey: childIdempotencyKey(idempotencyKey, 0),
      }),
      { assignedMechanicId: undefined },
    );
    expect(prisma.workOrderMutation.create).toHaveBeenCalled();
  });

  describe('D14: who does each Job, chosen in Hallazgos', () => {
    const mechanicId = '00000000-0000-4000-8000-000000000050';
    const otherMechanicId = '00000000-0000-4000-8000-000000000051';

    function setup(activeMechanics: Array<{ id: string }>) {
      const prisma = {
        truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
        workOrder: { findFirst: vi.fn().mockResolvedValue(openWorkOrder()) },
        workOrderMutation: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({}),
        },
        user: {
          findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
            activeMechanics.filter((mechanic) => where.id.in.includes(mechanic.id))),
        },
        truckReadinessAssessment: { findFirst: vi.fn().mockResolvedValue(null) },
      };
      const workOrders = {
        addJobByManager: vi.fn()
          .mockResolvedValueOnce({ version: 4 })
          .mockResolvedValueOnce({ version: 5 }),
      };
      const service = new YardWorkPlanService(prisma as never, workOrders as never, {} as never);
      return { prisma, workOrders, service };
    }

    it('passes each Job owner to the manager add-job path and chains the version', async () => {
      const { prisma, workOrders, service } = setup([{ id: mechanicId }]);
      await service.addJobs(manager, truckId, {
        idempotencyKey,
        expectedVersion: 3,
        jobs: [
          { categoryId, displayName: 'Air Leak', assignedMechanicId: mechanicId },
          { categoryId, displayName: 'Brake Chamber' },
        ],
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [mechanicId] },
          active: true,
          capabilities: { some: { capability: 'MECHANIC_STANDARD' } },
        }),
      }));
      expect(workOrders.addJobByManager).toHaveBeenNthCalledWith(
        1,
        manager,
        workOrderId,
        expect.objectContaining({ displayName: 'Air Leak', expectedVersion: 3 }),
        { assignedMechanicId: mechanicId },
      );
      expect(workOrders.addJobByManager).toHaveBeenNthCalledWith(
        2,
        manager,
        workOrderId,
        expect.objectContaining({ displayName: 'Brake Chamber', expectedVersion: 4 }),
        { assignedMechanicId: undefined },
      );
      expect(prisma.workOrderMutation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          operation: 'work_plan_add_jobs',
          result: { added: 2, version: 5 },
        }),
      });
    });

    it('adds nothing when an assignee is inactive or not a Standard mechanic', async () => {
      const { prisma, workOrders, service } = setup([{ id: mechanicId }]);
      await expect(service.addJobs(manager, truckId, {
        idempotencyKey,
        expectedVersion: 3,
        jobs: [
          { categoryId, displayName: 'Air Leak', assignedMechanicId: mechanicId },
          { categoryId, displayName: 'Brake Chamber', assignedMechanicId: otherMechanicId },
        ],
      })).rejects.toBeInstanceOf(BadRequestException);
      expect(workOrders.addJobByManager).not.toHaveBeenCalled();
      expect(prisma.workOrderMutation.create).not.toHaveBeenCalled();
    });

    it('replays the same request without adding or assigning again', async () => {
      const { prisma, workOrders, service } = setup([{ id: mechanicId }]);
      const input = {
        idempotencyKey,
        expectedVersion: 3,
        jobs: [{ categoryId, displayName: 'Air Leak', assignedMechanicId: mechanicId }],
      };
      await service.addJobs(manager, truckId, input);
      const stored = prisma.workOrderMutation.create.mock.calls[0][0].data;
      prisma.workOrderMutation.findUnique.mockResolvedValue(stored);
      // The first request already bumped the version the retry still carries.
      prisma.workOrder.findFirst.mockResolvedValue(openWorkOrder({ version: 4 }));
      await service.addJobs(manager, truckId, input);
      expect(workOrders.addJobByManager).toHaveBeenCalledTimes(1);
    });

    it('treats a different assignee under the same key as a different mutation', async () => {
      const { prisma, service } = setup([{ id: mechanicId }, { id: otherMechanicId }]);
      await service.addJobs(manager, truckId, {
        idempotencyKey,
        expectedVersion: 3,
        jobs: [{ categoryId, displayName: 'Air Leak', assignedMechanicId: mechanicId }],
      });
      prisma.workOrderMutation.findUnique.mockResolvedValue(prisma.workOrderMutation.create.mock.calls[0][0].data);
      await expect(service.addJobs(manager, truckId, {
        idempotencyKey,
        expectedVersion: 3,
        jobs: [{ categoryId, displayName: 'Air Leak', assignedMechanicId: otherMechanicId }],
      })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('rejects Add work without expectedVersion when a Work Order is already open', async () => {
    const prisma = {
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      workOrder: { findFirst: vi.fn().mockResolvedValue(openWorkOrder()) },
      workOrderMutation: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const service = new YardWorkPlanService(prisma as never, {} as never, {} as never);
    await expect(service.addJobs(manager, truckId, {
      idempotencyKey,
      jobs: [{ categoryId, displayName: 'Air Leak' }],
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('records No issues found onto the Phase 1 Inspection requirement', async () => {
    const assessment = {
      id: '00000000-0000-4000-8000-000000000030',
      requirements: [{
        type: ReadinessRequirementType.INSPECTION,
        outcome: ReadinessRequirementOutcome.NOT_EVALUATED,
        version: 1,
      }],
    };
    const prisma = {
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      workOrder: { findFirst: vi.fn().mockResolvedValue(null) },
      truckReadinessAssessment: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(assessment)
          .mockResolvedValueOnce({
            ...assessment,
            requirements: [{
              type: ReadinessRequirementType.INSPECTION,
              outcome: ReadinessRequirementOutcome.COMPLETED,
              version: 2,
            }],
          }),
        findUnique: vi.fn().mockResolvedValue(assessment),
      },
    };
    const yardOperations = {
      startAssessment: vi.fn(),
      updateRequirement: vi.fn().mockResolvedValue({}),
    };
    const service = new YardWorkPlanService(prisma as never, {} as never, yardOperations as never);
    const plan = await service.recordInspection(manager, truckId, {
      outcome: WorkPlanInspectionOutcome.NO_ISSUES_FOUND,
      idempotencyKey,
    });
    expect(yardOperations.startAssessment).not.toHaveBeenCalled();
    expect(yardOperations.updateRequirement).toHaveBeenCalledWith(
      manager,
      assessment.id,
      ReadinessRequirementType.INSPECTION,
      expect.objectContaining({
        outcome: ReadinessRequirementOutcome.COMPLETED,
        expectedVersion: 1,
      }),
    );
    expect(plan.inspection.outcome).toBe(WorkPlanInspectionOutcome.NO_ISSUES_FOUND);
  });

  it('refuses No issues found when Shop Work jobs already exist', async () => {
    const prisma = {
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      workOrder: { findFirst: vi.fn().mockResolvedValue(openWorkOrder()) },
      truckReadinessAssessment: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new YardWorkPlanService(prisma as never, {} as never, {} as never);
    await expect(service.recordInspection(manager, truckId, {
      outcome: WorkPlanInspectionOutcome.NO_ISSUES_FOUND,
      idempotencyKey,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown trucks', async () => {
    const prisma = { truck: { findUnique: vi.fn().mockResolvedValue(null) } };
    const service = new YardWorkPlanService(prisma as never, {} as never, {} as never);
    await expect(service.get(manager, truckId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
