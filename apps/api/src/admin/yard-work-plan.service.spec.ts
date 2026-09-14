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
  pmAuthorized: false,
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
    );
    expect(prisma.workOrderMutation.create).toHaveBeenCalled();
  });

  it('rejects Add work without expectedVersion when a Work Order is already open', async () => {
    const prisma = {
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      workOrder: { findFirst: vi.fn().mockResolvedValue(openWorkOrder()) },
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
