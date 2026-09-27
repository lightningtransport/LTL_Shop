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
    workOrder: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function workPlanWorkOrderRow() {
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
      // LTR-144: PM and QC are mandatory steps; done here so Alignment/Detailing drive the phase.
      {
        id: '00000000-0000-4000-8000-000000000403',
        catalogJobId: '00000000-0000-4000-8000-000000000503',
        displayName: 'PM A Service',
        customDescription: null,
        status: JobStatus.COMPLETED,
        category: { id: '00000000-0000-4000-8000-000000000303', name: 'PM' },
      },
      {
        id: '00000000-0000-4000-8000-000000000404',
        catalogJobId: '00000000-0000-4000-8000-000000000504',
        displayName: 'Quality Check',
        customDescription: null,
        status: JobStatus.COMPLETED,
        category: { id: '00000000-0000-4000-8000-000000000304', name: 'Quality Check' },
      },
    ],
    mechanics: [],
    pauseEvents: [],
  };
}

describe('YardOperationsService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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
    expect(page.counts).toEqual({ notStarted: 0, underReview: 0, readyToGo: 0, blocked: 0, presenceUnknown: 2 });
    const unavailableFeeds = { status: 'unavailable', reason: 'integration_not_connected', items: [], total: 0 };
    expect(page.workLocation).toEqual(unavailableFeeds);
    expect(page.incomingTrucks).toEqual(unavailableFeeds);
    expect(page.upcomingDepartures).toEqual(unavailableFeeds);
    expect(prisma.workOrder.findMany).not.toHaveBeenCalled();

    const next = await service.list({ limit: 1, cursor: page.nextCursor });
    expect(next.items.map((item) => item.truck.truckNumber)).toEqual(['200']);
    expect(next.nextCursor).toBeNull();
    expect(JSON.stringify(prisma.truck.findMany.mock.calls[2][0].where)).toContain('100');
  });

  it('does not map agent-reporting or open work orders into movement feeds', async () => {
    vi.stubEnv('AGENT_REPORTING_KEY', 'secret');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rows: [{ unit: '614' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const prisma = createPrisma();
    prisma.truck.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.workOrder.findMany.mockResolvedValue([{
      displayId: 'WO-1',
      truck: {
        id: '00000000-0000-4000-8000-000000000001',
        truckNumber: '600',
        yardLocation: '301 Yard',
        samsaraTruckLocation: null,
      },
    }]);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ limit: 1 });
    const unavailable = { status: 'unavailable', reason: 'integration_not_connected', items: [], total: 0 };
    expect(page.workLocation).toEqual(unavailable);
    expect(page.incomingTrucks).toEqual(unavailable);
    expect(page.upcomingDepartures).toEqual(unavailable);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.workOrder.findMany).not.toHaveBeenCalled();
    expect(JSON.stringify(page)).not.toContain('secret');
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

  it('board phase matches Work Plan derivation without Mark Ready', async () => {
    const prisma = createPrisma();
    const row = truck('277', '00000000-0000-4000-8000-000000000001');
    const assessment = readiness(ReadinessRequirementOutcome.NOT_EVALUATED);
    assessment.requirements = assessment.requirements.map((requirement) =>
      requirement.type === ReadinessRequirementType.INSPECTION
        ? { ...requirement, outcome: ReadinessRequirementOutcome.COMPLETED }
        : requirement,
    );
    row.readinessAssessments = [assessment];
    row.workOrders = [workPlanWorkOrderRow()];
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
    expect(page.workPlanBoardCutover).toBe(true);
    expect(page.items[0].phase).toBe(WorkPlanPhase.ALIGNMENT);
    expect(page.items[0].phase).toBe(expected.phase);

    const filtered = await service.list({ phase: 'alignment' });
    expect(filtered.items).toHaveLength(1);

    const shopOnly = await service.list({ phase: 'shop_work' });
    expect(shopOnly.items).toHaveLength(0);
  });

  it('completing Alignment + Detailing with the WO still open yields ready_to_close (LTR-90)', async () => {
    const prisma = createPrisma();
    const row = truck('277', '00000000-0000-4000-8000-000000000001');
    const assessment = readiness(ReadinessRequirementOutcome.NOT_EVALUATED);
    assessment.requirements = assessment.requirements.map((requirement) =>
      requirement.type === ReadinessRequirementType.INSPECTION
        ? { ...requirement, outcome: ReadinessRequirementOutcome.COMPLETED }
        : requirement,
    );
    row.readinessAssessments = [assessment];
    const workOrder = workPlanWorkOrderRow();
    workOrder.jobs = workOrder.jobs.map((job) => ({ ...job, status: JobStatus.COMPLETED }));
    row.workOrders = [workOrder];
    prisma.truck.findMany.mockResolvedValue([row]);
    prisma.truck.count.mockResolvedValue(1);
    prisma.truck.findUnique.mockResolvedValue(row);
    const trucks = { getRepairHistory: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) };
    const service = new YardOperationsService(prisma as never, trucks as never, { log: vi.fn() } as never);

    const readyOnly = await service.list({ readiness: 'ready' });
    expect(readyOnly.items).toHaveLength(0);
    expect(readyOnly.counts.readyToGo).toBe(0);

    const page = await service.list({});
    expect(page.items[0].phase).toBe(WorkPlanPhase.READY_TO_CLOSE);

    const detail = await service.detail(row.id);
    expect(detail.phase).toBe(WorkPlanPhase.READY_TO_CLOSE);
  });

  describe('Ready to Go after WO completion (LTR-90 / D1)', () => {
    function completedSetup(serviceEvent: { status: string; occurredAt: Date } | null) {
      vi.stubEnv('YARD_READY_TO_GO_SINCE', '2026-09-25T00:00:00.000Z');
      const prisma = createPrisma();
      const row = truck('277', '00000000-0000-4000-8000-000000000001');
      row.workOrders = [];
      row.readinessAssessments = [];
      (row as { serviceStatusEvents: unknown[] }).serviceStatusEvents = serviceEvent ? [serviceEvent] : [];
      const completed = {
        ...workPlanWorkOrderRow(),
        truckId: row.id,
        status: WorkOrderStatus.COMPLETED,
        completedAt: new Date('2026-09-26T15:00:00.000Z'),
        jobs: [
          { ...workPlanWorkOrderRow().jobs[0], id: 'i', displayName: 'General Inspection', category: { id: 'c-i', name: 'Inspection' }, status: JobStatus.COMPLETED },
          { ...workPlanWorkOrderRow().jobs[0], id: 'a', displayName: 'Alignment', category: { id: 'c-a', name: 'Suspension & Steering' }, status: JobStatus.COMPLETED },
          { ...workPlanWorkOrderRow().jobs[0], id: 'd', displayName: 'Detailing', category: { id: 'c-d', name: 'Detailing' }, status: JobStatus.COMPLETED },
          { ...workPlanWorkOrderRow().jobs[0], id: 'p', displayName: 'PM A Service', category: { id: 'c-p', name: 'PM' }, status: JobStatus.COMPLETED },
          { ...workPlanWorkOrderRow().jobs[0], id: 'q', displayName: 'Quality Check', category: { id: 'c-q', name: 'Quality Check' }, status: JobStatus.COMPLETED },
        ],
      };
      prisma.truck.findMany.mockResolvedValue([row]);
      prisma.truck.findUnique.mockResolvedValue(row);
      prisma.workOrder.findMany.mockResolvedValue([completed]);
      const trucks = { getRepairHistory: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) };
      return { prisma, service: new YardOperationsService(prisma as never, trucks as never, { log: vi.fn() } as never) };
    }

    it('keeps the truck on the board as Ready to Go until Return to Service', async () => {
      const { service } = completedSetup(null);
      const page = await service.list({ readiness: 'ready' });
      expect(page.items).toHaveLength(1);
      expect(page.items[0].phase).toBe(WorkPlanPhase.READY_TO_GO);
      expect(page.items[0].activeWorkOrder?.status).toBe(WorkOrderStatus.COMPLETED);
      expect(page.counts.readyToGo).toBe(1);
    });

    it('drops the truck once it was Returned to Service after completion', async () => {
      const { service } = completedSetup({ status: 'in_service', occurredAt: new Date('2026-09-26T18:00:00.000Z') });
      const page = await service.list({});
      expect(page.items).toHaveLength(0);
      expect(page.counts.readyToGo).toBe(0);
    });

    it('ignores completed Work Orders when YARD_READY_TO_GO_SINCE is unset', async () => {
      const { prisma, service } = completedSetup(null);
      vi.stubEnv('YARD_READY_TO_GO_SINCE', '');
      const page = await service.list({});
      expect(JSON.stringify(prisma.truck.findMany.mock.calls[0][0].where)).not.toContain('completedAt');
      expect(page.items.every((item) => item.phase !== WorkPlanPhase.READY_TO_GO)).toBe(true);
      expect(prisma.workOrder.findMany).not.toHaveBeenCalled();
    });
  });

  it('LTR-75: post-wipe fleet with no yard engagement is an empty board', async () => {
    const prisma = createPrisma();
    const idle = [
      truck('100', '00000000-0000-4000-8000-000000000001'),
      truck('200', '00000000-0000-4000-8000-000000000002'),
    ];
    prisma.truck.findMany.mockImplementation(async (args: { where?: unknown }) => {
      return querySelectsYardEngagement(args?.where) ? [] : idle;
    });
    prisma.truck.count.mockResolvedValue(idle.length);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ limit: 25 });

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(page.counts).toEqual({ notStarted: 0, underReview: 0, readyToGo: 0, blocked: 0, presenceUnknown: 2 });
    expect(querySelectsYardEngagement(prisma.truck.findMany.mock.calls[0][0].where)).toBe(true);
    expect(querySelectsYardEngagement(prisma.truck.findMany.mock.calls[1][0].where)).toBe(true);
  });

  it('LTR-144: a legacy PM Work Order sits in the PM column, not Inspection', async () => {
    const prisma = createPrisma();
    const pmTruck = truck('923', '00000000-0000-4000-8000-000000000001');
    pmTruck.workOrders = [{
      ...workPlanWorkOrderRow(),
      status: WorkOrderStatus.IN_PROGRESS,
      primaryCategory: { id: 'pm-cat', name: 'PM' },
      jobs: [],
    }] as never;
    prisma.truck.findMany.mockResolvedValue([pmTruck]);
    prisma.truck.count.mockResolvedValue(1);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ limit: 25 });
    expect(page.pmPhaseEnabled).toBe(true);
    expect(page.items[0].phase).toBe('pm');
    expect(page.items[0].readyReason).toBe('pm_pending');
    expect(page.items[0].blockers).toContainEqual({ kind: 'required_requirement', requirementType: 'pm' });
  });

  it('LTR-98: an unresolved mechanic blocker marks the truck Blocked', async () => {
    const prisma = createPrisma();
    const blocked = truck('277', '00000000-0000-4000-8000-000000000001');
    blocked.workOrders = [{
      ...workPlanWorkOrderRow(),
      status: WorkOrderStatus.IN_PROGRESS,
      pauseEvents: [{
        id: 'b-1', workOrderId: '00000000-0000-4000-8000-000000000201', reason: 'waiting_for_parts', notes: null,
        startedAt: new Date(), endedAt: new Date(), durationMs: 0n, isOfficialPause: false, resolvedAt: null,
      }],
    }] as never;
    prisma.truck.findMany.mockResolvedValue([blocked]);
    prisma.truck.count.mockResolvedValue(1);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ limit: 25 });
    expect(page.counts.blocked).toBe(1);
    expect(page.items[0].activeWorkOrder?.latestReportedBlocker?.reason).toBe('waiting_for_parts');
    // LTR-101: the board card says why the Truck is not Ready yet.
    expect(page.items[0].readyReason).toEqual(expect.any(String));
  });

  it('LTR-92: only an officially paused Work Order counts and filters as Blocked', async () => {
    const prisma = createPrisma();
    const running = truck('277', '00000000-0000-4000-8000-000000000001');
    running.workOrders = [{ ...workPlanWorkOrderRow(), status: WorkOrderStatus.IN_PROGRESS }];
    const paused = truck('906', '00000000-0000-4000-8000-000000000002');
    paused.workOrders = [{ ...workPlanWorkOrderRow(), id: '00000000-0000-4000-8000-000000000202', status: WorkOrderStatus.WAITING_PAUSED }];
    prisma.truck.findMany.mockResolvedValue([running, paused]);
    prisma.truck.count.mockResolvedValue(2);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ limit: 25 });
    expect(page.counts.blocked).toBe(1);
    const blockedOnly = await service.list({ limit: 25, blocked: 'true' });
    expect(blockedOnly.items.map((item) => item.truck.truckNumber)).toEqual(['906']);
  });

  it('LTR-75: an open Work Order enters the board on the derived Work Plan phase', async () => {
    const prisma = createPrisma();
    const idle = truck('100', '00000000-0000-4000-8000-000000000099');
    const engaged = truck('277', '00000000-0000-4000-8000-000000000001');
    engaged.workOrders = [workPlanWorkOrderRow()];
    const fleet = [idle, engaged];
    prisma.truck.findMany.mockImplementation(async (args: { where?: unknown }) => {
      if (!querySelectsYardEngagement(args?.where)) return fleet;
      return fleet.filter((row) => row.workOrders.length > 0 || row.readinessAssessments.length > 0);
    });
    prisma.truck.count.mockResolvedValue(fleet.length);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ limit: 25 });

    expect(page.items.map((item) => item.truck.truckNumber)).toEqual(['277']);
    expect(page.items[0].phase).toBe(WorkPlanPhase.ALIGNMENT);
    expect(page.counts.underReview).toBe(1);
    expect(page.counts.readyToGo).toBe(0);
    // LTR-92 / D5: open work alone is not Blocked; only an official pause is.
    expect(page.counts.blocked).toBe(0);
    expect(page.counts.presenceUnknown).toBe(2);
  });

  it('LTR-75: an active assessment without a Work Order is engagement and stays in Inspection', async () => {
    const prisma = createPrisma();
    const engaged = truck('300', '00000000-0000-4000-8000-000000000001');
    engaged.readinessAssessments = [readiness(ReadinessRequirementOutcome.NOT_EVALUATED)];
    prisma.truck.findMany.mockImplementation(async (args: { where?: unknown }) => {
      return querySelectsYardEngagement(args?.where) ? [engaged] : [];
    });
    prisma.truck.count.mockResolvedValue(4);
    const service = new YardOperationsService(prisma as never, {} as never, { log: vi.fn() } as never);

    const page = await service.list({ limit: 25 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].phase).toBe(WorkPlanPhase.INSPECTION);
    expect(page.items[0].activeWorkOrder).toBeNull();
    // LTR-100: the Inspection bucket counts it; an assessment is not a blocker.
    expect(page.counts.notStarted).toBe(1);
    expect(page.counts.blocked).toBe(0);
    expect(page.counts.readyToGo).toBe(0);
    expect(page.counts.presenceUnknown).toBe(4);
  });
});

function querySelectsYardEngagement(where: unknown) {
  const serialized = JSON.stringify(where);
  return serialized.includes('"workOrders"')
    && serialized.includes('readinessAssessments')
    && serialized.includes('under_review')
    && serialized.includes('ready')
    && serialized.includes('waiting_paused')
    && serialized.includes('readyAt');
}
