import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  JobStatus,
  ReadinessAssessmentStatus,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  WorkOrderStatus,
  WorkPlanPhase,
} from '@ltl-shop/shared';
import { YardOperationsService } from './yard-operations.service';
import { READINESS_REQUIREMENT_TYPES } from './yard-operations-derivation';
import { deriveWorkPlan } from './yard-work-plan-derivation';

const truck = (number: string, id: string) => ({
  id,
  truckNumber: number,
  make: 'Volvo', model: 'VNL', year: 2024, mileage: null, company: null, owner: null,
  workOrders: [] as any[],
  readinessAssessments: [] as any[],
  serviceStatusEvents: [] as any[],
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

function slice2WorkOrderRow() {
  return {
    id: '00000000-0000-4000-8000-000000000201',
    displayId: 'WO-201',
    status: WorkOrderStatus.CREATED,
    version: 3,
    priority: 'normal',
    createdAt: new Date('2026-09-16T12:00:00.000Z'),
    startedAt: null,
    completedAt: null,
    updatedAt: new Date('2026-09-16T12:00:00.000Z'),
    truck: {
      id: '00000000-0000-4000-8000-000000000001',
      truckNumber: '277',
      make: 'Peterbilt',
      model: '579',
      year: 2022,
    },
    primaryCategory: { id: '00000000-0000-4000-8000-000000000301', name: 'Alignment' },
    jobs: [
      {
        id: '00000000-0000-4000-8000-000000000400',
        catalogJobId: '00000000-0000-4000-8000-000000000500',
        displayName: 'Brake Inspection',
        customDescription: null,
        status: JobStatus.COMPLETED,
        category: { id: '00000000-0000-4000-8000-000000000300', name: 'Air & Brake System' },
      },
      {
        id: '00000000-0000-4000-8000-000000000401',
        catalogJobId: '00000000-0000-4000-8000-000000000501',
        displayName: 'Alignment',
        customDescription: null,
        status: JobStatus.TO_DO,
        category: { id: '00000000-0000-4000-8000-000000000301', name: 'Alignment' },
      },
      {
        id: '00000000-0000-4000-8000-000000000402',
        catalogJobId: '00000000-0000-4000-8000-000000000502',
        displayName: 'Detailing',
        customDescription: null,
        status: JobStatus.TO_DO,
        category: { id: '00000000-0000-4000-8000-000000000302', name: 'Detailing' },
      },
    ],
    mechanics: [],
    pauseEvents: [],
  };
}

describe('YardOperationsService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

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
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ phase: 'ready_for_approval', blocked: 'true' });
    expect(page.items).toHaveLength(0);
    expect(prisma.truck.findMany).toHaveBeenCalled();

    const noBlockers = await service.list({ phase: 'ready_for_approval', blocked: 'false' });
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
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ limit: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.counts).toEqual({ underReview: 1, readyToGo: 1, blocked: 1, presenceUnknown: 10 });
  });

  it('does not treat a stored address as yard presence', async () => {
    const prisma = createPrisma();
    const row = {
      ...truck('100', '00000000-0000-4000-8000-000000000001'),
      vin: '1XKYD49X0LJ123456',
      samsaraTruckLocation: 'West Main Street, Woodville, OH, 43469',
      samsaraLastConnectedDate: new Date('2026-09-11T00:00:00.000Z'),
    };
    prisma.truck.findMany
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([]);
    prisma.truck.count.mockResolvedValue(1);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ limit: 1 });
    expect(page.items[0].truck).toMatchObject({
      vin: '1XKYD49X0LJ123456',
      location: 'West Main Street, Woodville, OH, 43469',
      locationUpdatedOn: '2026-09-11',
    });
    expect(page.items[0].presence).toEqual({ state: 'unknown', provenance: 'phase_1_unavailable' });
    expect(page.counts.presenceUnknown).toBe(1);
  });

  it('loads Truck detail with location separate from Phase 1 presence', async () => {
    const prisma = createPrisma();
    const row = {
      ...truck('608', '00000000-0000-4000-8000-000000000608'),
      vin: '1M1AN4GY5RM045983',
      samsaraTruckLocation: 'US 301, Bradford County, FL',
      samsaraLastConnectedDate: new Date('2026-09-12T00:00:00.000Z'),
    };
    prisma.truck.findUnique.mockResolvedValue(row);
    const trucks = { getRepairHistory: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) };
    const service = new YardOperationsService(prisma as never, trucks as never, { log: vi.fn() } as never);

    await expect(service.detail('00000000-0000-4000-8000-000000000608')).resolves.toMatchObject({
      truck: {
        truckNumber: '608',
        vin: '1M1AN4GY5RM045983',
        location: 'US 301, Bradford County, FL',
        locationUpdatedOn: '2026-09-12',
      },
      presence: { state: 'unknown', provenance: 'phase_1_unavailable' },
      repairHistory: { items: [], nextCursor: null },
    });
  });

  it('returns not found for a missing Truck detail', async () => {
    const prisma = createPrisma();
    prisma.truck.findUnique.mockResolvedValue(null);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);
    await expect(service.detail('00000000-0000-4000-8000-000000000001')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('Slice 2: board phase matches Work Plan derivation without Mark Ready', async () => {
    vi.stubEnv('YARD_WORK_PLAN_SLICE2', 'true');
    const prisma = createPrisma();
    const row = truck('277', '00000000-0000-4000-8000-000000000001');
    const assessment = readiness(ReadinessRequirementOutcome.NOT_EVALUATED);
    assessment.requirements = assessment.requirements.map((requirement) =>
      requirement.type === ReadinessRequirementType.INSPECTION
        ? { ...requirement, outcome: ReadinessRequirementOutcome.COMPLETED }
        : requirement,
    );
    row.readinessAssessments = [assessment];
    row.workOrders = [slice2WorkOrderRow()];
    prisma.truck.findMany.mockResolvedValue([row]);
    prisma.truck.count.mockResolvedValue(1);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const expected = deriveWorkPlan({
      workOrder: {
        id: row.workOrders[0].id,
        displayId: row.workOrders[0].displayId,
        status: row.workOrders[0].status,
        version: row.workOrders[0].version,
        primaryCategoryName: row.workOrders[0].primaryCategory.name,
      },
      jobs: row.workOrders[0].jobs,
      inspectionRequirementOutcome: ReadinessRequirementOutcome.COMPLETED,
    });

    const page = await service.list({ limit: 25 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].phase).toBe(WorkPlanPhase.ALIGNMENT);
    expect(page.items[0].phase).toBe(expected.phase);

    const filtered = await service.list({ phase: 'alignment' });
    expect(filtered.items).toHaveLength(1);

    const shopOnly = await service.list({ phase: 'shop_work' });
    expect(shopOnly.items).toHaveLength(0);
  });

  it('Slice 2: completing Alignment + Detailing yields ready_to_go on board', async () => {
    vi.stubEnv('YARD_WORK_PLAN_SLICE2', 'true');
    const prisma = createPrisma();
    const row = truck('277', '00000000-0000-4000-8000-000000000001');
    const assessment = readiness(ReadinessRequirementOutcome.NOT_EVALUATED);
    assessment.requirements = assessment.requirements.map((requirement) =>
      requirement.type === ReadinessRequirementType.INSPECTION
        ? { ...requirement, outcome: ReadinessRequirementOutcome.COMPLETED }
        : requirement,
    );
    row.readinessAssessments = [assessment];
    const workOrder = slice2WorkOrderRow();
    workOrder.jobs = workOrder.jobs.map((job) => ({ ...job, status: JobStatus.COMPLETED }));
    row.workOrders = [workOrder];
    prisma.truck.findMany.mockResolvedValue([row]);
    prisma.truck.count.mockResolvedValue(1);
    prisma.truck.findUnique.mockResolvedValue(row);
    const trucks = { getRepairHistory: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) };
    const service = new YardOperationsService(prisma as never, trucks as never, { log: vi.fn() } as never);

    const page = await service.list({ readiness: 'ready' });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].phase).toBe(WorkPlanPhase.READY_TO_GO);
    expect(page.counts.readyToGo).toBe(1);

    const detail = await service.detail(row.id);
    expect(detail.phase).toBe(WorkPlanPhase.READY_TO_GO);
  });

  it('Slice 2 off: board stays on six-gate phase even with Work Plan jobs present', async () => {
    const prisma = createPrisma();
    const row = truck('277', '00000000-0000-4000-8000-000000000001');
    row.readinessAssessments = [readiness(ReadinessRequirementOutcome.NOT_EVALUATED)];
    row.workOrders = [slice2WorkOrderRow()];
    prisma.truck.findMany
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([]);
    prisma.truck.count.mockResolvedValue(1);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ limit: 1 });
    expect(page.items[0].phase).toBe('inspection');
    expect(page.items[0].phase).not.toBe(WorkPlanPhase.SHOP_WORK);
  });
});
