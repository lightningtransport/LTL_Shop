import { describe, expect, it, vi } from 'vitest';
import {
  ActivityEventType,
  AppCapability,
  ReadinessAssessmentStatus,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
} from '@ltl-shop/shared';
import { YardOperationsService } from './yard-operations.service';
import { idempotencyFingerprint } from '../common/idempotency';

const truckId = '00000000-0000-4000-8000-000000000001';
const assessmentId = '00000000-0000-4000-8000-000000000002';
const user = {
  id: '00000000-0000-4000-8000-000000000003',
  email: 'manager@example.com',
  name: 'Manager',
  role: 'manager' as const,
  active: true,
  capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE],
  supabaseAuthId: null,
};

const requirements = Object.values(ReadinessRequirementType).map((type, index) => ({
  id: `00000000-0000-4000-8000-0000000001${String(index + 1).padStart(2, '0')}`,
  assessmentId,
  type,
  outcome: ReadinessRequirementOutcome.NOT_EVALUATED,
  waiverReason: null,
  evidenceWorkOrderId: null,
  evaluatedById: null,
  evaluatedAt: null,
  version: 1,
}));

const assessment = {
  id: assessmentId,
  truckId,
  status: ReadinessAssessmentStatus.UNDER_REVIEW,
  version: 1,
  startedAt: new Date('2026-09-08T12:00:00.000Z'),
  startedById: user.id,
  readyAt: null,
  approvedById: null,
  closedAt: null,
  closedById: null,
  closedReason: null,
  requirements,
};

describe('Yard Operations readiness mutations', () => {
  it('starts an assessment with exactly six requirements and links the open Work Order', async () => {
    const created = { ...assessment, requirements };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      truck: { findUnique: vi.fn().mockResolvedValue({ id: truckId }) },
      truckReadinessAssessment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      workOrder: {
        findFirst: vi.fn().mockResolvedValue({ id: 'wo-1', displayId: 'WO-1', status: 'in_progress' }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      readinessMutation: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
      },
      activityLog: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      readinessMutation: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const activity = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new YardOperationsService(prisma as never, {} as never, activity as never);

    const result = await service.startAssessment(user, truckId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000010',
    });

    expect(tx.truckReadinessAssessment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requirements: { create: expect.any(Array) } }),
    }));
    expect(tx.truckReadinessAssessment.create.mock.calls[0][0].data.requirements.create).toHaveLength(6);
    expect(tx.workOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wo-1' },
      data: { readinessAssessmentId: assessmentId },
    }));
    expect(activity.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventType: ActivityEventType.READINESS_ASSESSMENT_STARTED,
    }));
    expect((result as unknown as { linkedWorkOrderId: string | null }).linkedWorkOrderId).toBe('wo-1');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns the stored result for a repeated idempotency key without a second transaction', async () => {
    const stored = { assessment: { id: assessmentId }, linkedWorkOrderId: null };
    const prisma = {
      readinessMutation: { findUnique: vi.fn().mockResolvedValue({
        operation: 'start_assessment',
        targetKey: `truck:${truckId}`,
        payloadHash: idempotencyFingerprint({ truckId }),
        actorId: user.id,
        result: stored,
      }) },
      $transaction: vi.fn(),
    };
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);
    const result = await service.startAssessment(user, truckId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000011',
    });
    expect(result).toEqual(stored);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('replays a start result found after waiting for the truck lock', async () => {
    const stored = { assessment: { id: assessmentId }, linkedWorkOrderId: null };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      readinessMutation: { findUnique: vi.fn().mockResolvedValue({
        operation: 'start_assessment',
        targetKey: `truck:${truckId}`,
        payloadHash: idempotencyFingerprint({ truckId }),
        actorId: user.id,
        result: stored,
      }) },
      truck: { findUnique: vi.fn() },
      truckReadinessAssessment: { findFirst: vi.fn(), create: vi.fn() },
    };
    const prisma = {
      readinessMutation: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    await expect(service.startAssessment(user, truckId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000022',
    })).resolves.toEqual(stored);
    expect(tx.truck.findUnique).not.toHaveBeenCalled();
    expect(tx.truckReadinessAssessment.create).not.toHaveBeenCalled();
  });

  it('rejects reusing a readiness idempotency key for another target or payload', async () => {
    const prisma = {
      readinessMutation: {
        findUnique: vi.fn().mockResolvedValue({
          operation: 'start_assessment',
          targetKey: 'truck:00000000-0000-4000-8000-000000000999',
          payloadHash: 'different-payload',
          actorId: user.id,
          result: { assessment: { id: assessmentId } },
        }),
      },
      $transaction: vi.fn(),
    };
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    await expect(service.startAssessment(user, truckId, {
      idempotencyKey: '00000000-0000-4000-8000-000000000013',
    })).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSE' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires linked, same-truck, relevant completed evidence for maintenance requirements', async () => {
    const assessmentRow = { ...assessment, requirements };
    const assessmentLookup = vi.fn()
      .mockResolvedValueOnce({ truckId })
      .mockResolvedValueOnce(assessmentRow);
    const tx = {
      truckReadinessAssessment: { findUnique: assessmentLookup },
      workOrder: {
        findUnique: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000020',
          truckId,
          status: 'completed',
          displayId: 'WO-20',
          readinessAssessmentId: null,
          primaryCategory: { name: 'PM' },
          jobs: [],
        }),
      },
      readinessMutation: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const prisma = {
      readinessMutation: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    await expect(service.updateRequirement(user, assessmentId, ReadinessRequirementType.PM, {
      outcome: ReadinessRequirementOutcome.COMPLETED,
      expectedVersion: 1,
      evidenceWorkOrderId: '00000000-0000-4000-8000-000000000020',
      idempotencyKey: '00000000-0000-4000-8000-000000000021',
    })).rejects.toThrow('linked to this readiness assessment');
  });

  it('does not withdraw Ready when only the waiver reason changes', async () => {
    const waived = requirements.map((requirement) => (
      requirement.type === ReadinessRequirementType.DETAILING
        ? { ...requirement, outcome: ReadinessRequirementOutcome.WAIVED, waiverReason: 'wash later' }
        : { ...requirement, outcome: ReadinessRequirementOutcome.NOT_REQUIRED }
    ));
    const readyAssessment = {
      ...assessment,
      status: ReadinessAssessmentStatus.READY,
      readyAt: new Date('2026-09-12T12:00:00.000Z'),
      approvedById: user.id,
      requirements: waived,
    };
    const updated = { ...readyAssessment, version: 2, requirements: waived };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      truckReadinessAssessment: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ truckId })
          .mockResolvedValueOnce(readyAssessment),
        update: vi.fn().mockResolvedValue(updated),
      },
      readinessRequirement: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      readinessMutation: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    };
    const activity = { log: vi.fn().mockResolvedValue(undefined) };
    const prisma = {
      readinessMutation: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new YardOperationsService(prisma as never, {} as never, activity as never);

    await service.updateRequirement(user, assessmentId, ReadinessRequirementType.DETAILING, {
      outcome: ReadinessRequirementOutcome.WAIVED,
      waiverReason: 'detailing scheduled tonight',
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000030',
    });

    expect(tx.truckReadinessAssessment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ status: ReadinessAssessmentStatus.UNDER_REVIEW }),
    }));
    expect(activity.log).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventType: ActivityEventType.READINESS_APPROVAL_INVALIDATED,
    }));
  });

  it('withdraws Ready when a resolved requirement becomes unresolved', async () => {
    const completed = requirements.map((requirement) => ({
      ...requirement,
      outcome: ReadinessRequirementOutcome.NOT_REQUIRED,
    }));
    const readyAssessment = {
      ...assessment,
      status: ReadinessAssessmentStatus.READY,
      readyAt: new Date('2026-09-12T12:00:00.000Z'),
      approvedById: user.id,
      requirements: completed,
    };
    const updated = {
      ...readyAssessment,
      status: ReadinessAssessmentStatus.UNDER_REVIEW,
      readyAt: null,
      approvedById: null,
      version: 2,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      truckReadinessAssessment: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ truckId })
          .mockResolvedValueOnce(readyAssessment),
        update: vi.fn().mockResolvedValue(updated),
      },
      readinessRequirement: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      readinessMutation: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    };
    const activity = { log: vi.fn().mockResolvedValue(undefined) };
    const prisma = {
      readinessMutation: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new YardOperationsService(prisma as never, {} as never, activity as never);

    await service.updateRequirement(user, assessmentId, ReadinessRequirementType.QUALITY_CHECK, {
      outcome: ReadinessRequirementOutcome.REQUIRED,
      expectedVersion: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000031',
    });

    expect(tx.truckReadinessAssessment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: ReadinessAssessmentStatus.UNDER_REVIEW, readyAt: null, approvedById: null }),
    }));
    expect(activity.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventType: ActivityEventType.READINESS_APPROVAL_INVALIDATED,
    }));
  });
});
