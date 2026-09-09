import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ReadinessAssessmentStatus, ReadinessRequirementOutcome, ReadinessRequirementType } from '@ltl-shop/shared';
import { YardOperationsService } from './yard-operations.service';
import { READINESS_REQUIREMENT_TYPES } from './yard-operations-derivation';

const truck = (number: string, id: string) => ({
  id,
  truckNumber: number,
  make: 'Volvo', model: 'VNL', year: 2024, mileage: null, company: null, owner: null,
  workOrders: [] as any[],
  readinessAssessments: [] as any[],
});

const readiness = (outcome: ReadinessRequirementOutcome = ReadinessRequirementOutcome.NOT_REQUIRED) => ({
  id: '00000000-0000-4000-8000-000000000101',
  truckId: '00000000-0000-4000-8000-000000000001',
  status: ReadinessAssessmentStatus.UNDER_REVIEW,
  version: 1,
  startedAt: new Date('2026-09-08T12:00:00.000Z'),
  startedById: '00000000-0000-4000-8000-000000000002',
  readyAt: null,
  approvedById: null,
  closedAt: null,
  closedById: null,
  closedReason: null,
  requirements: READINESS_REQUIREMENT_TYPES.map((type: ReadinessRequirementType) => ({
    id: `00000000-0000-4000-8000-00000000010${type.length % 9}`,
    type,
    outcome,
    waiverReason: null,
    evidenceWorkOrderId: null,
    evaluatedById: null,
    evaluatedAt: null,
    version: 1,
  })),
  workOrders: [],
});

function createPrisma() {
  return {
    truck: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

describe('YardOperationsService', () => {
  it('returns stable cursor pages and explicit unavailable integrations', async () => {
    const prisma = createPrisma();
    const first = truck('100', '00000000-0000-4000-8000-000000000001');
    const second = truck('200', '00000000-0000-4000-8000-000000000002');
    prisma.truck.findMany
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([second])
      .mockResolvedValueOnce([]);
    prisma.truck.count.mockResolvedValue(2);
    const service = new YardOperationsService(prisma as never, {} as never);

    const page = await service.list({ limit: 1 });
    expect(page.items.map((item) => item.truck.truckNumber)).toEqual(['100']);
    expect(page.nextCursor).toBeTypeOf('string');
    expect(page.counts).toEqual({ underReview: 0, readyToGo: 0, blocked: 0, presenceUnknown: 2 });
    expect(page.incomingTrucks).toEqual({ status: 'unavailable', reason: 'integration_not_connected' });
    expect(page.upcomingDepartures).toEqual({ status: 'unavailable', reason: 'integration_not_connected' });

    const next = await service.list({ limit: 1, cursor: page.nextCursor });
    expect(next.items.map((item) => item.truck.truckNumber)).toEqual(['200']);
    expect(next.nextCursor).toBeNull();
    expect(JSON.stringify(prisma.truck.findMany.mock.calls[2][0].where)).toContain('100');
  });

  it('applies evidence-backed filters after deriving phase and blockers', async () => {
    const prisma = createPrisma();
    const row = truck('100', '00000000-0000-4000-8000-000000000001');
    row.readinessAssessments = [readiness()];
    prisma.truck.findMany
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([]);
    const service = new YardOperationsService(prisma as never, {} as never);

    const page = await service.list({ phase: 'needs_evaluation', blocked: 'true' });
    expect(page.items).toHaveLength(0);
    expect(prisma.truck.findMany).toHaveBeenCalled();

    const noBlockers = await service.list({ phase: 'needs_evaluation', blocked: 'false' });
    expect(noBlockers.items).toHaveLength(1);
  });

  it('returns authoritative counts from the separate database summary query', async () => {
    const prisma = createPrisma();
    const pageRow = truck('100', '00000000-0000-4000-8000-000000000001');
    const completeRequirements = READINESS_REQUIREMENT_TYPES.map((type) => ({ type, outcome: 'completed' }));
    prisma.truck.findMany
      .mockResolvedValueOnce([pageRow])
      .mockResolvedValueOnce([
        { readinessAssessments: [{ status: 'under_review', requirements: completeRequirements, workOrders: [] }] },
        { readinessAssessments: [{ status: 'ready', requirements: completeRequirements, workOrders: [] }] },
        { readinessAssessments: [{ status: 'ready', requirements: completeRequirements, workOrders: [{ id: 'wo-1', status: 'in_progress' }] }] },
      ]);
    prisma.truck.count.mockResolvedValue(10);
    const service = new YardOperationsService(prisma as never, {} as never);

    const page = await service.list({ limit: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.counts).toEqual({ underReview: 1, readyToGo: 1, blocked: 1, presenceUnknown: 10 });
  });

  it('returns not found for a missing Truck detail', async () => {
    const prisma = createPrisma();
    prisma.truck.findUnique.mockResolvedValue(null);
    const service = new YardOperationsService(prisma as never, {} as never);
    await expect(service.detail('00000000-0000-4000-8000-000000000001')).rejects.toBeInstanceOf(NotFoundException);
  });
});
