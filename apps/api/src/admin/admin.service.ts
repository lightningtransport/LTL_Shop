import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AppCapability,
  Prisma,
  Priority,
  JobStatus,
  WorkOrderStatus,
  type PauseReason,
  type TruckFaultSeverity,
} from '@prisma/client';
import {
  isPmCategory,
  WorkPlanJobLane,
  adminChangePmServiceSchema,
  workOrderAttentionRank,
  workOrderAttentionReason,
  ActivityEventType as SharedActivityEventType,
  JobStatus as SharedJobStatus,
  OPEN_WORK_ORDER_STATUSES,
  BlockerReason as SharedBlockerReason,
  PauseReason as SharedPauseReason,
  Priority as SharedPriority,
  WorkOrderStatus as SharedWorkOrderStatus,
  adminAssignJobSchema,
  adminUnassignJobSchema,
  adminAddHelperJobSchema,
  adminSendJobExternalSchema,
  adminReturnJobExternalSchema,
  adminCancelWorkOrderSchema,
  adminCompleteWorkOrderSchema,
  adminReopenWorkOrderSchema,
  adminPatchWorkOrderSchema,
  adminTimeCorrectionSchema,
  adminCancelJobSchema,
  adminCompleteJobSchema,
  adminReopenJobSchema,
  adminReturnToServiceSchema,
  adminHistoryQuerySchema,
  adminMechanicCursorSchema,
  adminMechanicsQuerySchema,
  adminTruckCursorSchema,
  adminTrucksQuerySchema,
  adminWorkOrderCursorSchema,
  adminWorkOrdersQuerySchema,
  type AdminDashboardDto,
  type WorkOrderNoteDto,
  type AdminCatalogCategoryDetailDto,
  type AdminCatalogCategorySummaryDto,
  type AdminMechanicCursor,
  type AdminMechanicDetailDto,
  type AdminMechanicSummaryDto,
  type AdminMechanicsQuery,
  type AdminPage,
  type AdminTruckCursor,
  type AdminTruckSummaryDto,
  type AdminTrucksQuery,
  type AdminWorkOrderCursor,
  type AdminWorkOrderDetailDto,
  type AdminWorkOrderSummaryDto,
  type AdminWorkOrdersQuery,
  CatalogStatus,
  TruckOperationalStatus,
} from '@ltl-shop/shared';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { idempotencyFingerprint } from '../common/idempotency';
import { lockTruckMutation } from '../common/truck-mutation-lock';
import { PrismaService } from '../prisma/prisma.service';
import { toSharedCapability } from '../auth/capabilities';
import { toTruckDto } from '../trucks/trucks.service';
import { truckAttention } from '../integrations/samsara/samsara-faults';
import { computeTotals, canFinishWorkOrder, sessionDurationMs } from '../work-orders/work-order.timing';
import { resolveActiveBlockers } from '../work-orders/blockers';
import { closeActiveAssessments, reopenAssessmentOfWorkOrder } from './readiness-visit';
import { returnedToServiceAfter, yardReadyToGoSince } from './yard-ready-window';
import { stopLaborForMechanic } from '../work-orders/labor-session';
import { classifyWorkPlanLane, toJobExternalDto } from './yard-work-plan-derivation';
import { YardOperationsService } from './yard-operations.service';
import { joinWorkOrderTeam, workOrderTeam } from '../work-orders/work-order-team';
import { activeInspectionInclude, activeInspectionOutcome, workOrderNextStep, type NextStepWorkOrderRow } from './work-order-next-step';
import { assertPmObservedMileage } from '../work-orders/pm-mileage.guard';
import { applyPmObservedMileage, assertPmServiceReadyToFinish } from '../work-orders/pm-finish';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { LaborClockService } from '../work-orders/labor-clock.service';
import { blockerActivityLogsInclude, blockerLogDetails, toWorkOrderNoteDto, workOrderNoteInclude } from '../work-orders/work-order.mapper';
import { getShopDashboardWindows } from './admin-time';
import { syncWorkOrderLabor } from '../parts-costs/labor-ledger';

const ATTENTION_LIMIT = 8;
// D1 / UX-5-002 (stage 3): the Dashboard queue lists everything that waits on the Manager. A shop has
// tens of open Work Orders, not thousands; the cap only guards against a runaway query.
const DASHBOARD_QUEUE_LIMIT = 200;

/** LTR-188 / D24: the four columns that say a Job is at an external shop, cleared. */
const CLEAR_EXTERNAL = { externalSince: null, externalKind: null, externalNote: null, externalById: null } as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(id: string) {
  return UUID_RE.test(id);
}

function uniqueWorkOrders<T extends { id: string }>(groups: T[][], limit: number): T[] {
  const seen = new Set<string>();
  const selected: T[] = [];
  for (const group of groups) {
    for (const row of group) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      selected.push(row);
      if (selected.length === limit) return selected;
    }
  }
  return selected;
}

const mechanicCapabilityWhere: Prisma.UserWhereInput = {
  capabilities: {
    some: { capability: { in: [AppCapability.MECHANIC_STANDARD, AppCapability.MECHANIC_PM] } },
  },
};

/** LTR-185 / D19: the roster also shows Safety; Job pickers (`assignable`) do not offer them. */
const rosterCapabilityWhere: Prisma.UserWhereInput = {
  capabilities: {
    some: { capability: { in: [AppCapability.MECHANIC_STANDARD, AppCapability.MECHANIC_PM, AppCapability.QUALITY_CHECK_PERFORM] } },
  },
};

const mechanicAssignmentInclude = {
  workOrder: {
    select: {
      id: true,
      displayId: true,
      status: true,
      completedAt: true,
      truck: { select: { truckNumber: true } },
      primaryCategory: { select: { name: true } },
    },
  },
} as const;

/**
 * ME1: a person's open work is the Jobs they own that are still to do on open Work Orders — the same rule
 * that blocks deactivating them (D22) — not `mechanic_assignments`, which PM and Safety never join.
 */
const mechanicListInclude = {
  capabilities: { select: { capability: true } },
  assignedJobs: {
    where: { status: 'to_do' as const, workOrder: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } } },
    select: { id: true, displayName: true, workflowStepKey: true, ...mechanicAssignmentInclude },
    orderBy: { addedAt: 'asc' as const },
  },
  // LTR-197 / D28, LTR-199: the steps whose team this person is on.
  workflowStepMemberships: {
    select: {
      step: {
        select: { stepKey: true, sortOrder: true, catalogJob: { select: { displayName: true } }, _count: { select: { members: true } } },
      },
    },
  },
};

const mechanicDetailInclude = {
  ...mechanicListInclude,
  removedBy: { select: { id: true, name: true } },
};

const summaryInclude = {
  // LTR-159: the truck's active Inspection outcome feeds the one Next step rule.
  truck: { include: activeInspectionInclude },
  primaryCategory: true,
  jobs: {
    select: {
      id: true, status: true, assignedMechanicId: true, displayName: true, addedAt: true,
      // LTR-188 / D23, D24: helper Jobs and Jobs at an external shop feed the Next step.
      helperOfJobId: true, externalSince: true, externalKind: true, externalNote: true, workflowStepKey: true, systemKey: true,
      category: { select: { name: true } },
      assignedMechanic: { select: { id: true, name: true } },
    },
    orderBy: { addedAt: 'asc' as const },
  },
  mechanics: {
    where: { removedAt: null },
    include: { mechanic: { select: { id: true, name: true } } },
    orderBy: { addedAt: 'asc' as const },
  },
  // LTR-182: a completed Work Order still says "Return to Service" until it happens.
  serviceStatusEvents: {
    where: { status: 'in_service' as const },
    orderBy: { occurredAt: 'desc' as const },
    take: 1,
  },
  pauseEvents: {
    where: {
      OR: [
        { endedAt: null },
        { isOfficialPause: false },
      ],
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
      job: { select: { id: true, displayName: true } },
    },
    orderBy: { startedAt: 'desc' as const },
  },
  // LTR-164 (#8): the active blocker's notes on the Dashboard.
  activityLogs: blockerActivityLogsInclude,
};

const detailInclude = {
  ...summaryInclude,
  createdBy: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
  jobs: {
    include: {
      category: { select: { name: true } },
      assignedMechanic: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
      // LTR-200 / PC-3: outside shop invoices tied to the Job (the controller hides them from non-Managers).
      outsideRepairs: {
        where: { voidedAt: null },
        select: { id: true, amountCents: true, vendor: { select: { name: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
      // D45 / ST-1: parts bought for the Job (the controller drops their cost for non-Managers).
      purchaseLines: {
        where: { purchase: { voidedAt: null } },
        select: { purchaseId: true, description: true, partNumber: true, quantity: true, lineTotalCents: true, purchase: { select: { vendor: { select: { name: true } } } } },
        orderBy: [{ purchase: { invoiceDate: 'asc' as const } }, { sortOrder: 'asc' as const }],
      },
    },
    orderBy: { addedAt: 'asc' as const },
  },
  sessions: {
    // LTR-184 / D18: the Admin sees whose clock each session is.
    include: { user: { select: { id: true, name: true } } },
    orderBy: { startedAt: 'asc' as const },
  },
  pauseEvents: {
    include: {
      createdBy: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
      job: { select: { id: true, displayName: true } },
    },
    orderBy: { startedAt: 'desc' as const },
  },
  activityLogs: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  noteEntries: workOrderNoteInclude,
  pmService: { select: { observedMileage: true, workOrderJobId: true, _count: { select: { parts: true } } } },
  serviceStatusEvents: {
    where: { status: 'in_service' as const },
    orderBy: { occurredAt: 'desc' as const },
    take: 1,
  },
};

type SummaryRow = Prisma.WorkOrderGetPayload<{ include: typeof summaryInclude }>;

/**
 * LTR-182: the Work Orders a Truck row needs for its Next step: the open one, or
 * the ones completed since `YARD_READY_TO_GO_SINCE` (newest first) so the row can
 * say "Return to Service" exactly like Truck Detail and the Yard do.
 */
function readyToGoOrOpenWorkOrderWhere(): Prisma.WorkOrderWhereInput {
  const since = yardReadyToGoSince();
  const open: Prisma.WorkOrderWhereInput = { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } };
  if (!since) return open;
  return { OR: [open, { status: WorkOrderStatus.completed, completedAt: { gte: since } }] };
}

/** A completed Work Order keeps its truck Ready to Go while it is inside the window and not yet returned to service. */
function keepsTruckReadyToGo(
  completedAt: Date | null,
  serviceEvents: Array<{ status: string; occurredAt: Date }> | undefined,
): boolean {
  const since = yardReadyToGoSince();
  if (!since || !completedAt || completedAt < since) return false;
  return !returnedToServiceAfter(serviceEvents?.[0] ?? null, completedAt);
}
type DetailRow = Prisma.WorkOrderGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly workOrders: WorkOrdersService,
    private readonly yard?: YardOperationsService,
    private readonly clock?: LaborClockService,
  ) {}

  // Manager-first ownership: a Manager (work_orders.manage) plans the
  // intervention. Reuses the shared create path (truck advisory lock,
  // idempotency, one-open-WO-per-Truck, multi-category Jobs) with a Manager
  // actor so no mechanic capability is required and PM is rejected.
  async createWorkOrder(user: AuthUser, body: unknown) {
    const created = await this.workOrders.createByManager(user, body);
    return this.detail(created.id);
  }

  // Manager-first ownership: the Manager pauses/resumes the Work Order. Reuses
  // the mechanic pause/resume mechanics, then returns the admin detail DTO.
  async resolveBlocker(user: AuthUser, workOrderId: string, blockerId: string, body: unknown = {}): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId) || !isUuid(blockerId)) throw new BadRequestException('Invalid id');
    await this.workOrders.resolveBlocker(user, workOrderId, blockerId, body);
    return this.detail(workOrderId);
  }

  // LTR-126: the Manager appends a note (never overwrites a mechanic's note).
  async addNote(user: AuthUser, workOrderId: string, body: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    await this.workOrders.addNote(user, workOrderId, body, { managerActor: true });
    return this.detail(workOrderId);
  }

  async handleWorkRequest(user: AuthUser, workOrderId: string, noteId: string): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId) || !isUuid(noteId)) throw new BadRequestException('Invalid id');
    await this.workOrders.handleWorkRequest(user, workOrderId, noteId);
    return this.detail(workOrderId);
  }

  async unhandleWorkRequest(user: AuthUser, workOrderId: string, noteId: string): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId) || !isUuid(noteId)) throw new BadRequestException('Invalid id');
    await this.workOrders.unhandleWorkRequest(user, workOrderId, noteId);
    return this.detail(workOrderId);
  }

  async pauseWorkOrder(user: AuthUser, workOrderId: string, body: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    await this.workOrders.pauseByManager(user, workOrderId, body);
    return this.detail(workOrderId);
  }

  async resumeWorkOrder(user: AuthUser, workOrderId: string): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    await this.workOrders.resumeByManager(user, workOrderId);
    return this.detail(workOrderId);
  }

  async dashboard(): Promise<AdminDashboardDto> {
    const openWhere: Prisma.WorkOrderWhereInput = {
      status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] },
    };
    const now = new Date();
    const windows = getShopDashboardWindows(now);
    const olderThan24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // PF9: every read here is independent; they all go out together (Ready to Go and the queue used to wait).
    const [open, waitingPaused, highCriticalOpen, openOlderThan24h, completedToday, completedLast7Days, attention, workRequests, readyToGo, queue] =
      await Promise.all([
        this.prisma.workOrder.count({ where: openWhere }),
        this.prisma.workOrder.count({ where: { status: WorkOrderStatus.waiting_paused } }),
        this.prisma.workOrder.count({
          where: { ...openWhere, priority: { in: [Priority.high, Priority.critical] } },
        }),
        this.prisma.workOrder.count({
          where: { ...openWhere, createdAt: { lt: olderThan24h } },
        }),
        this.prisma.workOrder.count({
          where: {
            status: WorkOrderStatus.completed,
            completedAt: { gte: new Date(windows.today.from), lt: new Date(windows.today.to) },
          },
        }),
        this.prisma.workOrder.count({
          where: {
            status: WorkOrderStatus.completed,
            completedAt: { gte: new Date(windows.last7Days.from), lt: new Date(windows.last7Days.to) },
          },
        }),
        this.getAttention(openWhere),
        // LTR-126: open work requests on open Work Orders.
        this.prisma.workOrderNote.findMany({
          where: { kind: 'work_request', handledAt: null, workOrder: openWhere },
          include: {
            author: { select: { id: true, name: true } },
            workOrder: { select: { id: true, displayId: true, truck: { select: { id: true, truckNumber: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        // LTR-164 (#12): one Ready to Go rule, the Yard's (Work Plan phase), so both surfaces agree.
        this.yard?.countReadyToGoTrucks().then((count) => count ?? 0) ?? Promise.resolve(0),
        this.getDashboardQueue(openWhere),
      ]);

    return {
      generatedAt: now.toISOString(),
      source: 'supabase_postgres',
      timeZone: windows.timeZone,
      windows: {
        openOlderThan24h: { before: olderThan24h.toISOString() },
        today: windows.today,
        last7Days: windows.last7Days,
      },
      counts: { open, waitingPaused, highCriticalOpen, openOlderThan24h, completedToday, completedLast7Days, readyToGo },
      attention,
      queue,
      openWorkRequests: workRequests.map((request) => ({
        id: request.id,
        body: request.body,
        author: request.author,
        createdAt: request.createdAt.toISOString(),
        workOrderId: request.workOrder.id,
        workOrderDisplayId: request.workOrder.displayId,
        truckNumber: request.workOrder.truck.truckNumber,
        // Stage 8: the Dashboard row links to the Truck.
        truckId: request.workOrder.truck.id,
      })),
    };
  }

  async list(rawQuery: unknown): Promise<AdminPage<AdminWorkOrderSummaryDto>> {
    const parsed = adminWorkOrdersQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const query = parsed.data;
    const cursor = query.cursor ? this.decodeCursor(query.cursor, query) : null;
    const where = this.buildWhere(query, cursor);
    const rows = await this.prisma.workOrder.findMany({
      where,
      include: summaryInclude,
      orderBy: [
        { [query.sort]: query.direction },
        { id: query.direction },
      ] as Prisma.WorkOrderOrderByWithRelationInput[],
      take: query.limit + 1,
    });
    const hasNext = rows.length > query.limit;
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows;

    return {
      items: pageRows.map(toAdminSummary),
      nextCursor: hasNext
        ? this.encodeCursor(pageRows[pageRows.length - 1], query)
        : null,
    };
  }

  async detail(id: string): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(id)) throw new BadRequestException('Invalid Work Order id');
    await this.clock?.closeDue();
    const row = await this.prisma.workOrder.findUnique({ where: { id }, include: detailInclude });
    if (!row) throw new NotFoundException('Work Order not found');
    // PCA10 (UX-5-005): what the Work Order has cost so far (its labor and outside repairs in the truck's ledger).
    const entries = await this.prisma.truckCostEntry.findMany({ where: { workOrderId: id }, select: { kind: true, amountCents: true } });
    const sum = (kind: string) => entries.filter((entry) => entry.kind === kind).reduce((total, entry) => total + entry.amountCents, 0);
    return { ...toAdminDetail(row), costs: { partsCents: sum('part_purchase'), outsideCents: sum('outside_repair'), laborCents: sum('labor') } };
  }

  async listMechanics(rawQuery: unknown): Promise<AdminPage<AdminMechanicSummaryDto>> {
    const parsed = adminMechanicsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const query = parsed.data;
    const cursor = query.cursor ? this.decodeMechanicCursor(query.cursor, query) : null;
    const rows = await this.prisma.user.findMany({
      where: this.buildMechanicWhere(query, cursor),
      include: mechanicListInclude,
      orderBy: [{ name: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    const hasNext = rows.length > query.limit;
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows;
    return {
      items: pageRows.map(toMechanicSummary),
      nextCursor: hasNext ? this.encodeMechanicCursor(pageRows[pageRows.length - 1], query) : null,
    };
  }

  /**
   * LTR-159: trucks Ready to Go — their latest Work Order completed inside the Yard
   * window (`YARD_READY_TO_GO_SINCE`), no open Work Order, not yet Returned to Service.
   */
  async listTrucks(rawQuery: unknown): Promise<AdminPage<AdminTruckSummaryDto>> {
    const parsed = adminTrucksQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const query = parsed.data;
    const cursor = query.cursor ? this.decodeTruckCursor(query.cursor, query) : null;
    const rows = await this.prisma.truck.findMany({
      where: this.buildTruckWhere(query, cursor),
      include: {
        ...activeInspectionInclude,
        workOrders: {
          // LTR-182: the open Work Order, or else the completed one that keeps the truck Ready to Go.
          where: readyToGoOrOpenWorkOrderWhere(),
          include: {
            primaryCategory: { select: { name: true } },
            // LTR-159: enough of the Work Plan for the one Next step rule.
            jobs: {
              select: {
                id: true, status: true, displayName: true, assignedMechanicId: true,
                externalSince: true, externalKind: true, externalNote: true, workflowStepKey: true, systemKey: true,
                category: { select: { id: true, name: true } },
              },
              orderBy: { addedAt: 'asc' },
            },
            pauseEvents: {
              where: { OR: [{ endedAt: null }, { isOfficialPause: false, resolvedAt: null }] },
              include: { job: { select: { id: true, displayName: true } }, reportedBy: { select: { name: true } } },
              orderBy: { startedAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
          // One open Work Order per truck; a second row can only be the Ready to Go one.
          take: 2,
        },
        serviceStatusEvents: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
        },
        // D35 / S-3: active Samsara faults for the Faults column.
        faults: { where: { clearedAt: null }, select: { severity: true } },
      },
      orderBy: [{ truckNumber: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    const hasNext = rows.length > query.limit;
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows;
    return {
      items: pageRows.map(toTruckSummary),
      nextCursor: hasNext ? this.encodeTruckCursor(pageRows[pageRows.length - 1], query) : null,
    };
  }

  async listCatalogCategories(): Promise<AdminCatalogCategorySummaryDto[]> {
    const rows = await this.prisma.jobCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        catalogJobs: {
          select: {
            status: true,
            systemKey: true,
            _count: { select: { aliases: true } },
          },
        },
      },
    });
    return rows.map(toCatalogCategorySummary);
  }

  async catalogCategoryDetail(id: string): Promise<AdminCatalogCategoryDetailDto> {
    if (!isUuid(id)) throw new BadRequestException('Invalid Category id');
    const row = await this.prisma.jobCategory.findUnique({
      where: { id },
      include: {
        catalogJobs: {
          include: {
            aliases: { select: { id: true, aliasText: true }, orderBy: { aliasText: 'asc' } },
            workflowSteps: { select: { stepKey: true } },
            _count: { select: { workOrderJobs: true } },
          },
          orderBy: [{ status: 'asc' }, { displayName: 'asc' }],
        },
      },
    });
    if (!row) throw new NotFoundException('Category not found');
    const summary = toCatalogCategorySummary({
      ...row,
      catalogJobs: row.catalogJobs.map((job) => ({
        status: job.status,
        systemKey: job.systemKey,
        _count: { aliases: job.aliases.length },
      })),
    });
    return {
      ...summary,
      jobs: row.catalogJobs.map((job) => ({
        id: job.id,
        displayName: job.displayName,
        status: job.status as CatalogStatus,
        aliases: job.aliases.map((alias) => alias.aliasText),
        // LTR-198 / D30: the lock, "Used by" and the alias chips.
        systemKey: job.systemKey,
        aliasItems: job.aliases.map((alias) => ({ id: alias.id, text: alias.aliasText })),
        workOrderCount: job._count.workOrderJobs,
        usedByStep: job.workflowSteps[0]?.stepKey ?? null,
      })),
    };
  }

  async mechanicDetail(id: string): Promise<AdminMechanicDetailDto> {
    if (!isUuid(id)) throw new BadRequestException('Invalid Mechanic id');
    const row = await this.prisma.user.findFirst({
      // G9: the roster lists Safety (LTR-185), so its detail must open them too (not only Standard / PM).
      where: { id, ...rosterCapabilityWhere },
      include: mechanicDetailInclude,
    });
    if (!row) throw new NotFoundException('Mechanic not found');
    const [completedJobCount, closedWorkOrders, runningSession, completedJobs, history] = await Promise.all([
      this.prisma.workOrderJob.count({ where: { completedById: id, status: 'completed' } }),
      // ME4: the closed Work Orders where this person completed a Job, so the list agrees with "Completed Jobs".
      this.prisma.workOrder.findMany({
        where: { status: { in: ['completed', 'cancelled'] }, jobs: { some: { completedById: id, status: 'completed' } } },
        select: mechanicAssignmentInclude.workOrder.select,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        take: 10,
      }),
      this.prisma.workSession.findFirst({ where: { userId: id, endedAt: null }, select: { id: true } }),
      // ME4: the Jobs they completed, not just their Work Orders.
      this.prisma.workOrderJob.findMany({
        where: { completedById: id, status: 'completed' },
        select: { id: true, displayName: true, completedAt: true, workOrder: { select: { id: true, displayId: true, truck: { select: { truckNumber: true } } } } },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        take: 10,
      }),
      personHistoryCount(this.prisma, id),
    ]);
    return {
      ...toMechanicSummary(row),
      completedJobCount,
      recentClosedWorkOrders: closedWorkOrders.map((workOrder) => toMechanicAssignment({ workOrder })),
      // ME2 / SW3: what blocks deactivating and what a type change affects, known before the Manager confirms.
      pendingJobs: row.assignedJobs.map((job) => ({
        workOrderId: job.workOrder.id,
        workOrderDisplayId: job.workOrder.displayId,
        truckNumber: job.workOrder.truck.truckNumber,
        jobDisplayName: job.displayName,
        jobId: job.id,
        workflowStepKey: job.workflowStepKey,
      })),
      runningSession: Boolean(runningSession),
      defaultOwnerOfSteps: row.workflowStepMemberships
        .map((membership) => membership.step)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((step) => ({ stepKey: step.stepKey, jobDisplayName: step.catalogJob.displayName, memberCount: step._count.members })),
      recentCompletedJobs: completedJobs.map((job) => ({
        jobId: job.id,
        displayName: job.displayName,
        workOrderId: job.workOrder.id,
        displayId: job.workOrder.displayId,
        truckNumber: job.workOrder.truck.truckNumber,
        completedAt: job.completedAt?.toISOString() ?? null,
      })),
      // D31: a real delete only for someone who never did anything.
      canDelete: history === 0,
      removedBy: row.removedBy ?? null,
    };
  }

  async listHistory(rawQuery: unknown): Promise<AdminPage<AdminWorkOrderSummaryDto>> {
    const parsed = adminHistoryQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const query = parsed.data;
    return this.list({
      ...query,
      status: query.status ?? ['completed', 'cancelled'],
      priority: undefined,
      createdBefore: undefined,
    });
  }

  // Manager-first ownership: assign a specific Job to a mechanic. Additive and
  // independent of MechanicAssignment (the general team). A Job with no assignee
  // visually inherits the general team.
  /** LTR-145: switch a to-do PM job between PM Category catalog jobs (e.g. PM A ↔ PM B). */
  async changePmService(user: AuthUser, workOrderId: string, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const parsed = adminChangePmServiceSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_change_pm_service';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      jobId,
      catalogJobId: input.catalogJobId,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
          throw new BadRequestException('Cannot change a closed Work Order');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        if (!isPmCategory(job.category.name)) throw new BadRequestException('Only the PM job can change its PM service');
        if (job.status !== JobStatus.to_do) throw new BadRequestException('Job is not in To Do status');
        const target = await tx.catalogJob.findFirst({
          where: { id: input.catalogJobId, status: 'active', categoryId: job.categoryId },
          select: { id: true, displayName: true },
        });
        if (!target) throw new BadRequestException('Choose an active PM service from the catalog');
        if (target.id === job.catalogJobId) throw new BadRequestException('The PM job already uses this PM service');
        await tx.workOrderJob.update({
          where: { id: jobId },
          data: { catalogJobId: target.id, displayName: target.displayName },
        });
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MANAGER_CORRECTION,
          entityType: 'work_order_job',
          entityId: jobId,
          userId: user.id,
          previousValue: { jobId, catalogJobId: job.catalogJobId, displayName: job.displayName },
          newValue: { jobId, action: 'pm_service_changed', catalogJobId: target.id, displayName: target.displayName },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async assignJob(user: AuthUser, workOrderId: string, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const parsed = adminAssignJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_assign_job';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      jobId,
      mechanicId: input.mechanicId,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertMutableJobs(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        // LTR-188 / D24: a Job at an external shop gets its owner through "Returned".
        if (job.externalSince) {
          throw new BadRequestException({ code: 'JOB_AT_EXTERNAL_SHOP', message: 'This Job is at an external shop. Use Returned first.' });
        }
        const mechanic = await this.assignJobInTx(tx, user, workOrderId, job, input.mechanicId);
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MECHANIC_ADDED,
          entityType: 'work_order_job',
          entityId: jobId,
          userId: user.id,
          previousValue: { jobId, assignedMechanicId: job.assignedMechanicId },
          newValue: { jobId, action: 'job_assigned', assignedMechanicId: input.mechanicId, mechanicName: mechanic.name },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  /**
   * The owner change of `assignJob` (LTR-146 PM, LTR-185 QC, D11 team), shared with
   * "Returned → Assign to" (LTR-188 / D24). The caller bumps the version and logs.
   */
  private async assignJobInTx(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    workOrderId: string,
    job: DetailRow['jobs'][number],
    mechanicId: string,
  ) {
    // LTR-146: the PM job goes to a PM mechanic, who does not join the Standard team.
    const isPmJob = isPmCategory(job.category.name);
    // LTR-185 / D19: the Quality Check belongs to Safety, who is not on the team either.
    const isQcJob = classifyWorkPlanLane(job.category.name, job.displayName, job.systemKey) === WorkPlanJobLane.QUALITY_CHECK;
    if (isPmJob && (job.status !== JobStatus.to_do || job.startedAt)) {
      throw new BadRequestException('A started or finished PM job cannot be reassigned');
    }
    const requiredCapability = isPmJob
      ? AppCapability.MECHANIC_PM
      : isQcJob ? AppCapability.QUALITY_CHECK_PERFORM : AppCapability.MECHANIC_STANDARD;
    const mechanic = await tx.user.findFirst({
      where: {
        id: mechanicId,
        active: true,
        capabilities: { some: { capability: requiredCapability } },
      },
      select: { id: true, name: true },
    });
    if (!mechanic) {
      if (isQcJob) throw new BadRequestException({ code: 'QC_OWNER_MUST_BE_SAFETY', message: 'Only Safety can own the Quality Check.' });
      throw new BadRequestException(isPmJob ? 'This mechanic cannot perform PM work' : 'This mechanic cannot perform standard work');
    }
    // PM mechanics and Safety reach the Work Order through their own Job only.
    if (!isPmJob && !isQcJob) await joinWorkOrderTeam(tx, workOrderId, mechanicId, user.id);
    await tx.workOrderJob.update({
      where: { id: job.id },
      data: { assignedMechanicId: mechanicId },
    });
    if (job.assignedMechanicId && job.assignedMechanicId !== mechanicId) {
      await this.releaseMechanicFromWorkOrder(tx, workOrderId, job.assignedMechanicId);
    }
    return mechanic;
  }

  async unassignJob(user: AuthUser, workOrderId: string, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const parsed = adminUnassignJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_unassign_job';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      jobId,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertMutableJobs(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        if (!job.assignedMechanicId) throw new NotFoundException('Job is not assigned');
        await tx.workOrderJob.update({
          where: { id: jobId },
          data: { assignedMechanicId: null },
        });
        await this.releaseMechanicFromWorkOrder(tx, workOrderId, job.assignedMechanicId);
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MECHANIC_REMOVED,
          entityType: 'work_order_job',
          entityId: jobId,
          userId: user.id,
          previousValue: { jobId, assignedMechanicId: job.assignedMechanicId },
          newValue: { jobId, action: 'job_unassigned', assignedMechanicId: null },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  /**
   * LTR-154 / D11, D18: after a Job leaves a mechanic, drop them from the derived
   * team when they own no other Job here, and stop their labor when they have
   * no pending Job left.
   */
  private async releaseMechanicFromWorkOrder(tx: Prisma.TransactionClient, workOrderId: string, mechanicId: string) {
    const stillOwns = await tx.workOrderJob.count({
      where: { workOrderId, assignedMechanicId: mechanicId, status: { not: JobStatus.cancelled } },
    });
    if (stillOwns === 0) {
      await tx.mechanicAssignment.updateMany({
        where: { workOrderId, mechanicId, removedAt: null },
        data: { removedAt: new Date() },
      });
    }
    await stopLaborForMechanic(tx, workOrderId, mechanicId);
  }

  async cancelWorkOrder(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminCancelWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_cancel_work_order';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
          throw new BadRequestException('Cannot cancel a closed Work Order');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const now = new Date();
        // LTR-154 / D18: closing the Work Order stops every mechanic's labor.
        await tx.workSession.updateMany({ where: { workOrderId, endedAt: null }, data: { endedAt: now } });
        const openPause = await tx.pauseEvent.findFirst({
          where: { workOrderId, endedAt: null, isOfficialPause: true },
          orderBy: { startedAt: 'desc' },
        });
        if (openPause) {
          await tx.pauseEvent.update({
            where: { id: openPause.id },
            data: { endedAt: now, durationMs: BigInt(now.getTime() - openPause.startedAt.getTime()) },
          });
        }
        // LTR-176: nothing is left to unblock on a cancelled Work Order.
        await resolveActiveBlockers(tx, this.activity, { workOrderId, userId: user.id, note: 'Work Order cancelled.' }, now);
        // LTR-177: the visit is over; its inspection does not carry over to the next Work Order.
        await closeActiveAssessments(tx, this.activity, { truckId: wo.truckId, userId: user.id, reason: 'work_order_cancelled', workOrderId }, now);
        const sessions = await tx.workSession.findMany({ where: { workOrderId } });
        const pauses = await tx.pauseEvent.findMany({ where: { workOrderId } });
        const totals = computeTotals({ sessions, pauses, now });
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: {
            status: WorkOrderStatus.cancelled,
            completedAt: now,
            completedById: user.id,
            totalActiveLaborMs: BigInt(totals.totalActiveLaborMs),
            totalWaitingMs: BigInt(totals.totalWaitingMs),
            version: { increment: 1 },
          },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MANAGER_CORRECTION,
          entityType: 'work_order',
          entityId: workOrderId,
          userId: user.id,
          previousValue: { status: wo.status },
          newValue: { status: 'cancelled', reason: input.reason },
          relevantValue: { action: 'work_order_cancelled', reason: input.reason },
        });
        const persisted = await this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
        // LTR-201 / D34: the Work Order's labor in the truck's costs follows its status and its time.
        await syncWorkOrderLabor(tx, workOrderId, user.id);
        return persisted;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async completeWorkOrder(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminCompleteWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_complete_work_order';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        // LTR-175: a Work Order whose Jobs were all done by the PM mechanic or by
        // the Manager may still be `created`; with nothing pending it closes too.
        if (wo.status !== WorkOrderStatus.in_progress && wo.status !== WorkOrderStatus.created) {
          throw new BadRequestException('Work Order must be in progress to finish');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const isPm = wo.primaryCategory.name === 'PM';
        const pmService = isPm
          ? await tx.pmService.findUnique({ where: { workOrderId }, include: { parts: true } })
          : null;
        let observedMileage: number | null = null;
        if (isPm) {
          observedMileage = assertPmServiceReadyToFinish(pmService, wo.truck.mileage);
        } else {
          const gate = canFinishWorkOrder(wo.jobs);
          if (!gate.ok) throw new BadRequestException(gate.message);
        }
        const now = new Date();
        // LTR-154 / D18: closing the Work Order stops every mechanic's labor.
        await tx.workSession.updateMany({ where: { workOrderId, endedAt: null }, data: { endedAt: now } });
        const sessions = await tx.workSession.findMany({ where: { workOrderId } });
        const pauses = await tx.pauseEvent.findMany({ where: { workOrderId } });
        const totals = computeTotals({ sessions, pauses, now });
        if (isPm && observedMileage !== null) {
          await applyPmObservedMileage(tx, this.activity, {
            truckId: wo.truckId, workOrderId: wo.id, currentMileage: wo.truck.mileage,
            observedMileage, userId: user.id,
          });
        }
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: {
            status: WorkOrderStatus.completed,
            startedAt: wo.startedAt ?? now,
            completedAt: now,
            completedById: user.id,
            totalActiveLaborMs: BigInt(totals.totalActiveLaborMs),
            totalWaitingMs: BigInt(totals.totalWaitingMs),
            version: { increment: 1 },
          },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.WORK_ORDER_COMPLETED,
          entityType: 'work_order',
          entityId: workOrderId,
          userId: user.id,
          previousValue: { status: wo.status },
          newValue: {
            status: 'completed',
            totalActiveLaborMs: totals.totalActiveLaborMs,
            totalWaitingMs: totals.totalWaitingMs,
          },
        });
        const persisted = await this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
        // LTR-201 / D34: the Work Order's labor in the truck's costs follows its status and its time.
        await syncWorkOrderLabor(tx, workOrderId, user.id);
        return persisted;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async reopenWorkOrder(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminReopenWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_reopen_work_order';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if ((OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
          throw new BadRequestException('Cannot reopen an open Work Order');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const otherOpen = await tx.workOrder.findFirst({
          where: {
            truckId: wo.truckId,
            id: { not: workOrderId },
            status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] },
          },
        });
        if (otherOpen) {
          throw new BadRequestException('Truck already has an open Work Order.');
        }
        const nextStatus = wo.startedAt ? WorkOrderStatus.in_progress : WorkOrderStatus.created;
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: {
            status: nextStatus,
            completedAt: null,
            completedById: null,
            version: { increment: 1 },
          },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MANAGER_CORRECTION,
          entityType: 'work_order',
          entityId: workOrderId,
          userId: user.id,
          previousValue: { status: wo.status },
          newValue: { status: nextStatus, reason: input.reason },
          relevantValue: { action: 'work_order_reopened', reason: input.reason },
        });
        // LTR-177: a cancelled visit gets its inspection back when the Work Order is reopened.
        await reopenAssessmentOfWorkOrder(tx, this.activity, {
          truckId: wo.truckId, assessmentId: wo.readinessAssessmentId, userId: user.id, workOrderId,
        });
        const activeAssessment = tx.truckReadinessAssessment
          ? await tx.truckReadinessAssessment.findFirst({
              where: { truckId: wo.truckId, status: { in: ['under_review', 'ready'] } },
              orderBy: { updatedAt: 'desc' },
              select: { id: true, status: true, version: true, approvedById: true },
            })
          : null;
        if (activeAssessment?.status === 'ready') {
          await tx.truckReadinessAssessment.update({
            where: { id: activeAssessment.id },
            data: {
              status: 'under_review',
              readyAt: null,
              approvedById: null,
              version: { increment: 1 },
            },
          });
          await this.activity.log(tx, {
            eventType: SharedActivityEventType.READINESS_APPROVAL_INVALIDATED,
            entityType: 'readiness_assessment',
            entityId: activeAssessment.id,
            userId: user.id,
            previousValue: {
              status: activeAssessment.status,
              version: activeAssessment.version,
              approvedById: activeAssessment.approvedById,
            },
            newValue: { status: 'under_review', approvedById: null },
            relevantValue: { reason: 'work_order_reopened', workOrderId },
          });
        }
        const persisted = await this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
        // LTR-201 / D34: the Work Order's labor in the truck's costs follows its status and its time.
        await syncWorkOrderLabor(tx, workOrderId, user.id);
        return persisted;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async returnToService(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminReturnToServiceSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const operation = 'admin_return_to_service';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if ((OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
          throw new BadRequestException('Cannot return a Truck to service from an open Work Order');
        }
        if (wo.status !== WorkOrderStatus.completed) {
          throw new BadRequestException('Only a completed Work Order can return a Truck to service');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const alreadyReturned = await tx.truckServiceStatusEvent.findFirst({
          where: { workOrderId, status: 'in_service' },
        });
        if (alreadyReturned) {
          throw new BadRequestException('This Work Order already returned the Truck to service');
        }
        const latest = await tx.truckServiceStatusEvent.findFirst({
          where: { truckId: wo.truckId },
          orderBy: { occurredAt: 'desc' },
        });
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await tx.truckServiceStatusEvent.create({
          data: {
            truckId: wo.truckId,
            status: 'in_service',
            reason: input.reason ?? '',
            workOrderId,
            actorId: user.id,
          },
        });
        // LTR-164 (#13): the truck left the shop, so its readiness assessment ends here. Otherwise the
        // next Work Order would inherit this Inspection outcome and skip "Record the inspection".
        const activeAssessments = tx.truckReadinessAssessment
          ? await tx.truckReadinessAssessment.findMany({
              where: { truckId: wo.truckId, status: { in: ['under_review', 'ready'] } },
              select: { id: true, status: true, version: true },
            })
          : [];
        for (const assessment of activeAssessments) {
          await tx.truckReadinessAssessment.update({
            where: { id: assessment.id },
            data: {
              status: 'closed',
              closedAt: new Date(),
              closedById: user.id,
              closedReason: 'Returned to Service',
              version: { increment: 1 },
            },
          });
          await this.activity.log(tx, {
            eventType: SharedActivityEventType.READINESS_ASSESSMENT_CLOSED,
            entityType: 'readiness_assessment',
            entityId: assessment.id,
            userId: user.id,
            previousValue: { status: assessment.status, version: assessment.version },
            newValue: { status: 'closed', version: assessment.version + 1, closedReason: 'Returned to Service' },
            relevantValue: { truckId: wo.truckId, workOrderId },
          });
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.TRUCK_RETURNED_TO_SERVICE,
          entityType: 'truck',
          entityId: wo.truckId,
          userId: user.id,
          previousValue: { operationalStatus: latest?.status ?? 'unknown' },
          newValue: { operationalStatus: 'in_service', reason: input.reason },
          relevantValue: { action: 'returned_to_service', reason: input.reason },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async patchWorkOrder(user: AuthUser, workOrderId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    const parsed = adminPatchWorkOrderSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const nextNotes = input.notes === undefined ? undefined : (input.notes?.trim() || null);
    const operation = 'admin_patch_work_order';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      expectedVersion: input.expectedVersion,
      priority: input.priority ?? null,
      notes: nextNotes ?? null,
      notesProvided: input.notes !== undefined,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
          throw new BadRequestException('Cannot update fields on a closed Work Order');
        }
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        if (
          wo.primaryCategory.name === 'PM'
          && input.priority !== undefined
          && input.priority !== (wo.priority as SharedPriority)
        ) {
          throw new BadRequestException('PM Work Order priority cannot be changed');
        }
        const priorityChanged = input.priority !== undefined && input.priority !== (wo.priority as SharedPriority);
        // LTR-126: notes are append-only; a non-empty value adds a Manager note entry.
        const latestNote = wo.noteEntries?.[wo.noteEntries.length - 1]?.body ?? wo.notes;
        const notesChanged = typeof nextNotes === 'string' && nextNotes.length > 0 && nextNotes !== latestNote;
        if (!priorityChanged && !notesChanged) {
          throw new BadRequestException('No allowed fields changed');
        }
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: {
            ...(priorityChanged ? { priority: input.priority as Priority } : {}),
            version: { increment: 1 },
          },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        if (priorityChanged) {
          await this.activity.log(tx, {
            workOrderId,
            eventType: SharedActivityEventType.PRIORITY_CHANGED,
            entityType: 'work_order',
            entityId: workOrderId,
            userId: user.id,
            previousValue: { priority: wo.priority },
            newValue: { priority: input.priority },
          });
        }
        if (notesChanged) {
          const note = await tx.workOrderNote.create({
            data: { workOrderId, kind: 'note', body: nextNotes, authorId: user.id },
          });
          await this.activity.log(tx, {
            workOrderId,
            eventType: SharedActivityEventType.NOTE_ADDED,
            entityType: 'work_order_note',
            entityId: note.id,
            userId: user.id,
            newValue: { kind: note.kind, body: note.body, actor: 'manager' },
          });
        }
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async correctTime(user: AuthUser, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    const parsed = adminTimeCorrectionSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const workOrderId = input.workOrderId;
    const operation = 'admin_time_correction';
    const payloadHash = idempotencyFingerprint({
      workOrderId,
      targetType: input.targetType,
      targetId: input.targetId,
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const segment = input.targetType === 'work_session'
          ? await tx.workSession.findUnique({ where: { id: input.targetId } })
          : await tx.pauseEvent.findUnique({ where: { id: input.targetId } });
        if (!segment || segment.workOrderId !== workOrderId) {
          throw new NotFoundException('Time segment not found');
        }
        if (input.targetType === 'pause_event' && 'isOfficialPause' in segment && segment.isOfficialPause === false) {
          throw new BadRequestException('Cannot correct a reported blocker');
        }
        if (!segment.endedAt) {
          throw new BadRequestException('Cannot correct an open time segment');
        }
        const nextStartedAt = this.parseInstant(input.startedAt, segment.startedAt);
        const nextEndedAt = this.parseInstant(input.endedAt, segment.endedAt);
        if (nextEndedAt.getTime() <= nextStartedAt.getTime()) {
          throw new BadRequestException('endedAt must be after startedAt');
        }
        if (
          nextStartedAt.getTime() === segment.startedAt.getTime()
          && nextEndedAt.getTime() === segment.endedAt.getTime()
        ) {
          throw new BadRequestException('No time values changed');
        }
        if (input.targetType === 'work_session') {
          await tx.workSession.update({
            where: { id: input.targetId },
            data: { startedAt: nextStartedAt, endedAt: nextEndedAt },
          });
        } else {
          await tx.pauseEvent.update({
            where: { id: input.targetId },
            data: {
              startedAt: nextStartedAt,
              endedAt: nextEndedAt,
              durationMs: BigInt(nextEndedAt.getTime() - nextStartedAt.getTime()),
            },
          });
        }
        const sessions = await tx.workSession.findMany({ where: { workOrderId } });
        const pauses = await tx.pauseEvent.findMany({ where: { workOrderId } });
        const totals = computeTotals({ sessions, pauses, now: new Date() });
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: {
            totalActiveLaborMs: BigInt(totals.totalActiveLaborMs),
            totalWaitingMs: BigInt(totals.totalWaitingMs),
            version: { increment: 1 },
          },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MANAGER_CORRECTION,
          entityType: input.targetType,
          entityId: input.targetId,
          userId: user.id,
          previousValue: {
            startedAt: segment.startedAt.toISOString(),
            endedAt: segment.endedAt.toISOString(),
          },
          newValue: {
            startedAt: nextStartedAt.toISOString(),
            endedAt: nextEndedAt.toISOString(),
            reason: input.reason,
          },
          relevantValue: { action: 'time_corrected', targetType: input.targetType, reason: input.reason },
        });
        const persisted = await this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
        // LTR-201 / D34: the Work Order's labor in the truck's costs follows its status and its time.
        await syncWorkOrderLabor(tx, workOrderId, user.id);
        return persisted;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  private parseInstant(value: string | undefined, fallback: Date) {
    if (value === undefined) return fallback;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid timestamp');
    return parsed;
  }

  async cancelJob(user: AuthUser, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const parsed = adminCancelJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const preview = await this.prisma.workOrderJob.findUnique({ where: { id: jobId } });
    if (!preview) throw new NotFoundException('Job not found');
    const workOrderId = preview.workOrderId;
    const operation = 'admin_cancel_job';
    const payloadHash = idempotencyFingerprint({
      jobId,
      workOrderId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertMutableJobs(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        if (job.status !== JobStatus.to_do) {
          throw new BadRequestException('Job is not in To Do status');
        }
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await tx.workOrderJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.cancelled,
            cancelledAt: new Date(),
            cancelledReason: input.reason,
            // LTR-188 / D24: a cancelled Job is not waiting at an external shop any more.
            ...CLEAR_EXTERNAL,
          },
        });
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.JOB_CANCELLED,
          entityType: 'work_order_job',
          entityId: jobId,
          userId: user.id,
          previousValue: { status: job.status, displayName: job.displayName },
          newValue: { status: JobStatus.cancelled, reason: input.reason },
          relevantValue: { action: 'job_cancelled', reason: input.reason, displayName: job.displayName },
        });
        // LTR-176: a cancelled Job has nothing left to unblock.
        await resolveActiveBlockers(tx, this.activity, { workOrderId, jobId, userId: user.id, note: 'Job cancelled.' });
        await stopLaborForMechanic(tx, workOrderId, job.assignedMechanicId);
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  async completeJob(user: AuthUser, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const parsed = adminCompleteJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const preview = await this.prisma.workOrderJob.findUnique({ where: { id: jobId } });
    if (!preview) throw new NotFoundException('Job not found');
    const workOrderId = preview.workOrderId;
    const operation = 'admin_complete_job';
    const notes = input.notes?.trim() || null;
    const payloadHash = idempotencyFingerprint({
      jobId,
      workOrderId,
      expectedVersion: input.expectedVersion,
      notes,
      overrideSafetyReturn: input.overrideSafetyReturn ?? false,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertMutableJobs(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        if (job.status !== JobStatus.to_do) {
          throw new BadRequestException('Job is not in To Do status');
        }
        // LTR-216 (D19, D29): Safety returned this truck. Completing its Quality Check skips that review, so it takes
        // an explicit override with the Manager's reason; otherwise the work Safety asked for comes first.
        const overSafetyReturn = wo.pauseEvents.some((event) => event.jobId === job.id
          && event.isOfficialPause === false && !event.resolvedAt && event.blockerReason === SharedBlockerReason.QUALITY_CHECK_FAILED);
        if (overSafetyReturn && !input.overrideSafetyReturn) {
          throw new ConflictException({
            code: 'QC_RETURNED_BY_SAFETY',
            message: 'Safety returned this truck. Add the work Safety asked for, or confirm with a note to complete Quality Check anyway.',
          });
        }
        if (overSafetyReturn && !notes) {
          throw new BadRequestException({ code: 'QC_OVERRIDE_NOTE_REQUIRED', message: 'Say why Quality Check is completed over the Safety return.' });
        }
        await this.completeJobInTx(tx, user, wo, job, { notes, expectedVersion: input.expectedVersion, overSafetyReturn });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  /**
   * The Manager completes a pending Job (LTR-145 PM rule, LTR-175 first work,
   * LTR-176 blockers, D18 labor) and bumps the version. Shared with
   * "Returned → Complete" (LTR-188 / D24), where completedBy is the Manager.
   */
  private async completeJobInTx(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    wo: DetailRow,
    job: DetailRow['jobs'][number],
    options: { notes: string | null; expectedVersion: number; overSafetyReturn?: boolean },
  ) {
    const workOrderId = wo.id;
    // LTR-145: the PM job is finished from the PM service (mileage + parts), not a plain complete.
    if (isPmCategory(job.category.name)) {
      throw new BadRequestException({
        code: 'PM_JOB_USES_PM_SERVICE',
        message: 'The PM job is completed from the PM service with observed mileage and parts.',
      });
    }
    // LTR-175: work is happening on this Work Order, so it is no longer "created".
    const now = new Date();
    const startsWorkOrder = wo.status === WorkOrderStatus.created;
    const incremented = await tx.workOrder.updateMany({
      where: { id: workOrderId, version: options.expectedVersion },
      data: startsWorkOrder
        ? { status: WorkOrderStatus.in_progress, startedAt: now, version: { increment: 1 } }
        : { version: { increment: 1 } },
    });
    if (incremented.count !== 1) {
      throw this.versionConflict('Work Order was updated. Refresh and try again.');
    }
    await tx.workOrderJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.completed,
        completedAt: now,
        completedById: user.id,
        cancelledAt: null,
        cancelledReason: null,
        // LTR-188 / D24: done is done, wherever it was done.
        ...CLEAR_EXTERNAL,
      },
    });
    await this.activity.log(tx, {
      workOrderId,
      eventType: SharedActivityEventType.JOB_COMPLETED,
      entityType: 'work_order_job',
      entityId: job.id,
      userId: user.id,
      previousValue: { status: job.status, displayName: job.displayName },
      newValue: { status: JobStatus.completed, displayName: job.displayName, notes: options.notes },
      relevantValue: {
        action: 'job_completed', displayName: job.displayName, notes: options.notes, actor: 'admin',
        ...(options.overSafetyReturn ? { overSafetyReturn: true } : {}),
      },
    });
    if (startsWorkOrder) {
      await this.activity.log(tx, {
        workOrderId,
        eventType: SharedActivityEventType.WORK_STARTED,
        entityType: 'work_order',
        entityId: workOrderId,
        userId: user.id,
        previousValue: { status: WorkOrderStatus.created },
        newValue: { status: WorkOrderStatus.in_progress, startedAt: now.toISOString() },
      });
    }
    // LTR-176: the Manager completing a blocked Job settles its blocker (the work is done).
    await resolveActiveBlockers(tx, this.activity, {
      workOrderId,
      jobId: job.id,
      userId: user.id,
      note: options.overSafetyReturn
        ? `Quality Check completed by the Manager over the Safety return: ${options.notes}`
        : 'Job completed by the Manager.',
    }, now);
    await stopLaborForMechanic(tx, workOrderId, job.assignedMechanicId);
  }

  async reopenJob(user: AuthUser, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const parsed = adminReopenJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const preview = await this.prisma.workOrderJob.findUnique({ where: { id: jobId } });
    if (!preview) throw new NotFoundException('Job not found');
    const workOrderId = preview.workOrderId;
    const operation = 'admin_reopen_job';
    const payloadHash = idempotencyFingerprint({
      jobId,
      workOrderId,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
    });
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // LTR-186 / D20: clocks past the day close end at the cutoff before anything here stops them at now.
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        this.assertMutableJobs(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        if (job.status !== JobStatus.cancelled) {
          throw new BadRequestException('Job is not cancelled');
        }
        const incremented = await tx.workOrder.updateMany({
          where: { id: workOrderId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await tx.workOrderJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.to_do,
            cancelledAt: null,
            cancelledReason: null,
          },
        });
        await this.activity.log(tx, {
          workOrderId,
          eventType: SharedActivityEventType.MANAGER_CORRECTION,
          entityType: 'work_order_job',
          entityId: jobId,
          userId: user.id,
          previousValue: { status: job.status, displayName: job.displayName },
          newValue: { status: JobStatus.to_do, reason: input.reason },
          relevantValue: { action: 'job_reopened', reason: input.reason, displayName: job.displayName },
        });
        return this.persistWorkOrderMutation(tx, {
          idempotencyKey: input.idempotencyKey,
          workOrderId,
          operation,
          payloadHash,
          actorId: user.id,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  /**
   * LTR-188 / D23: another Standard mechanic helps on a Job. The helper gets a Job
   * of their own ("<Job> · helper" in the web; same catalog Job, Category and name)
   * so the one-owner rule (D11), their clock (D18, D20, D21) and blockers stay per Job.
   */
  async addHelperJob(user: AuthUser, workOrderId: string, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    const parsed = adminAddHelperJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const payloadHash = idempotencyFingerprint({ workOrderId, jobId, mechanicId: input.mechanicId, expectedVersion: input.expectedVersion });
    return this.runJobMutation(user, workOrderId, jobId, 'admin_add_helper_job', payloadHash, input, async (tx, wo, job) => {
      if (job.status !== JobStatus.to_do || job.externalSince) {
        throw new BadRequestException({ code: 'HELPER_JOB_NOT_OPEN', message: 'A helper can only be added to a pending Job of an open Work Order.' });
      }
      const lane = classifyWorkPlanLane(job.category.name, job.displayName, job.systemKey);
      if (lane === WorkPlanJobLane.PM || lane === WorkPlanJobLane.QUALITY_CHECK || job.helperOfJobId) {
        throw new BadRequestException({ code: 'HELPER_NOT_ALLOWED_HERE', message: 'This Job cannot have a helper.' });
      }
      const mechanic = await tx.user.findFirst({
        where: { id: input.mechanicId, active: true, capabilities: { some: { capability: AppCapability.MECHANIC_STANDARD } } },
        select: { id: true, name: true },
      });
      if (!mechanic || mechanic.id === job.assignedMechanicId) {
        throw new BadRequestException({ code: 'HELPER_INVALID_MECHANIC', message: 'Choose an active Standard mechanic who does not own this Job.' });
      }
      const already = wo.jobs.some((item) => item.helperOfJobId === job.id
        && item.assignedMechanicId === mechanic.id
        && item.status !== JobStatus.cancelled);
      if (already) {
        throw new BadRequestException({ code: 'HELPER_ALREADY_ADDED', message: 'This mechanic is already helping on this Job.' });
      }
      const helper = await tx.workOrderJob.create({
        data: {
          workOrderId,
          catalogJobId: job.catalogJobId,
          categoryId: job.categoryId,
          displayName: job.displayName,
          customDescription: job.customDescription,
          isCustom: job.isCustom,
          addedById: user.id,
          assignedMechanicId: mechanic.id,
          helperOfJobId: job.id,
          status: JobStatus.to_do,
        },
      });
      await joinWorkOrderTeam(tx, workOrderId, mechanic.id, user.id);
      await this.bumpVersion(tx, workOrderId, input.expectedVersion);
      await this.activity.log(tx, {
        workOrderId,
        eventType: SharedActivityEventType.JOB_ADDED,
        entityType: 'work_order_job',
        entityId: helper.id,
        userId: user.id,
        newValue: {
          jobId: helper.id,
          action: 'helper_added',
          helperOfJobId: job.id,
          displayName: job.displayName,
          assignedMechanicId: mechanic.id,
          mechanicName: mechanic.name,
        },
      });
      await this.activity.log(tx, {
        workOrderId,
        eventType: SharedActivityEventType.MECHANIC_ADDED,
        entityType: 'work_order_job',
        entityId: helper.id,
        userId: user.id,
        previousValue: { jobId: helper.id, assignedMechanicId: null },
        newValue: { jobId: helper.id, action: 'job_assigned', assignedMechanicId: mechanic.id, mechanicName: mechanic.name },
      });
    });
  }

  /**
   * LTR-188 / D24: the part or the whole truck goes to an external shop. The Job
   * stays to do but has no owner and no clock; its owner's clock here stops when it
   * was their last available Job, and its blocker (if any) is resolved.
   */
  async sendJobExternal(user: AuthUser, workOrderId: string, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    const parsed = adminSendJobExternalSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const payloadHash = idempotencyFingerprint({ workOrderId, jobId, kind: input.kind, note: input.note, expectedVersion: input.expectedVersion });
    return this.runJobMutation(user, workOrderId, jobId, 'admin_send_job_external', payloadHash, input, async (tx, wo, job) => {
      if (job.status !== JobStatus.to_do) {
        throw new BadRequestException('Job is not in To Do status');
      }
      // D19: the Quality Check is Safety's step at the end; it never goes out.
      if (classifyWorkPlanLane(job.category.name, job.displayName, job.systemKey) === WorkPlanJobLane.QUALITY_CHECK) {
        throw new BadRequestException({ code: 'EXTERNAL_NOT_ALLOWED_HERE', message: 'The Quality Check cannot go to an external shop.' });
      }
      if (job.externalSince) {
        throw new BadRequestException({ code: 'EXTERNAL_ALREADY', message: 'This Job is already at an external shop.' });
      }
      const now = new Date();
      await tx.workOrderJob.update({
        where: { id: job.id },
        data: {
          assignedMechanicId: null,
          externalSince: now,
          externalKind: input.kind,
          externalNote: input.note,
          externalById: user.id,
        },
      });
      await resolveActiveBlockers(tx, this.activity, { workOrderId, jobId: job.id, userId: user.id, note: 'Job sent to an external shop.' }, now);
      // Same path as unassign: off the team when they own nothing else here, clock stops without another available Job.
      if (job.assignedMechanicId) await this.releaseMechanicFromWorkOrder(tx, workOrderId, job.assignedMechanicId);
      await this.bumpVersion(tx, workOrderId, input.expectedVersion);
      await this.activity.log(tx, {
        workOrderId,
        eventType: SharedActivityEventType.MANAGER_CORRECTION,
        entityType: 'work_order_job',
        entityId: job.id,
        userId: user.id,
        previousValue: { jobId: job.id, assignedMechanicId: job.assignedMechanicId },
        newValue: { jobId: job.id, displayName: job.displayName, kind: input.kind, notes: input.note },
        relevantValue: { action: 'job_sent_external', kind: input.kind, displayName: job.displayName },
      });
    });
  }

  /** LTR-188 / D24: back from the external shop — complete the Job, or assign it (install / check). */
  async returnJobExternal(user: AuthUser, workOrderId: string, jobId: string, raw: unknown): Promise<AdminWorkOrderDetailDto> {
    const parsed = adminReturnJobExternalSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    const payloadHash = idempotencyFingerprint({
      workOrderId, jobId, outcome: input.outcome, mechanicId: input.mechanicId ?? null, expectedVersion: input.expectedVersion,
    });
    return this.runJobMutation(user, workOrderId, jobId, 'admin_return_job_external', payloadHash, input, async (tx, wo, job) => {
      if (job.status !== JobStatus.to_do || !job.externalSince) {
        throw new BadRequestException({ code: 'JOB_NOT_EXTERNAL', message: 'This Job is not at an external shop.' });
      }
      await tx.workOrderJob.update({ where: { id: job.id }, data: CLEAR_EXTERNAL });
      await this.activity.log(tx, {
        workOrderId,
        eventType: SharedActivityEventType.MANAGER_CORRECTION,
        entityType: 'work_order_job',
        entityId: job.id,
        userId: user.id,
        previousValue: { jobId: job.id, kind: job.externalKind, notes: job.externalNote },
        newValue: { jobId: job.id, displayName: job.displayName, outcome: input.outcome, assignedMechanicId: input.mechanicId ?? null },
        relevantValue: { action: 'job_returned_external', outcome: input.outcome, displayName: job.displayName },
      });
      if (input.outcome === 'complete') {
        await this.completeJobInTx(tx, user, wo, { ...job, ...CLEAR_EXTERNAL }, { notes: null, expectedVersion: input.expectedVersion });
        return;
      }
      const mechanic = await this.assignJobInTx(tx, user, workOrderId, { ...job, ...CLEAR_EXTERNAL }, input.mechanicId!);
      await this.bumpVersion(tx, workOrderId, input.expectedVersion);
      await this.activity.log(tx, {
        workOrderId,
        eventType: SharedActivityEventType.MECHANIC_ADDED,
        entityType: 'work_order_job',
        entityId: job.id,
        userId: user.id,
        previousValue: { jobId: job.id, assignedMechanicId: null },
        newValue: { jobId: job.id, action: 'job_assigned', assignedMechanicId: mechanic.id, mechanicName: mechanic.name },
      });
    });
  }

  /**
   * The shared shell of an Admin Job mutation (LTR-188): idempotency, day close
   * (D20), truck lock, open non-PM Work Order, expected version, the Job, then
   * `apply` (which bumps the version) and the stored result.
   */
  private async runJobMutation(
    user: AuthUser,
    workOrderId: string,
    jobId: string,
    operation: string,
    payloadHash: string,
    input: { idempotencyKey: string; expectedVersion: number },
    apply: (tx: Prisma.TransactionClient, wo: DetailRow, job: DetailRow['jobs'][number]) => Promise<void>,
  ): Promise<AdminWorkOrderDetailDto> {
    if (!isUuid(workOrderId)) throw new BadRequestException('Invalid Work Order id');
    if (!isUuid(jobId)) throw new BadRequestException('Invalid Job id');
    const existing = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.clock?.closeDue(tx);
        const initial = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!initial) throw new NotFoundException('Work Order not found');
        await lockTruckMutation(tx, initial.truckId);
        const replay = await this.findWorkOrderMutationInTx(tx, input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId }, include: detailInclude });
        if (!wo) throw new NotFoundException('Work Order not found');
        const job = wo.jobs.find((item) => item.id === jobId);
        if (!job) throw new NotFoundException('Job not found');
        if (operation === 'admin_add_helper_job'
          && (wo.primaryCategory.name === 'PM' || !(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status))) {
          throw new BadRequestException({ code: 'HELPER_JOB_NOT_OPEN', message: 'A helper can only be added to a pending Job of an open Work Order.' });
        }
        this.assertMutableJobs(wo);
        if (wo.version !== input.expectedVersion) {
          throw this.versionConflict('Work Order was updated. Refresh and try again.');
        }
        await apply(tx, wo, job);
        return this.persistWorkOrderMutation(tx, { idempotencyKey: input.idempotencyKey, workOrderId, operation, payloadHash, actorId: user.id });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const replay = await this.findWorkOrderMutation(input.idempotencyKey, workOrderId, operation, payloadHash, user.id);
        if (replay) return replay;
      }
      throw error;
    }
  }

  private async bumpVersion(tx: Prisma.TransactionClient, workOrderId: string, expectedVersion: number) {
    const incremented = await tx.workOrder.updateMany({
      where: { id: workOrderId, version: expectedVersion },
      data: { version: { increment: 1 } },
    });
    if (incremented.count !== 1) {
      throw this.versionConflict('Work Order was updated. Refresh and try again.');
    }
  }

  private assertMutableJobs(wo: DetailRow) {
    if (wo.primaryCategory.name === 'PM') {
      throw new BadRequestException('PM Work Orders do not use jobs');
    }
    if (!(OPEN_WORK_ORDER_STATUSES as string[]).includes(wo.status)) {
      throw new BadRequestException('Cannot change Jobs on a closed Work Order');
    }
  }

  private versionConflict(message: string) {
    return new ConflictException({ code: 'VERSION_CONFLICT', message });
  }

  private isUniqueViolation(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async findWorkOrderMutation(
    key: string,
    workOrderId: string,
    operation: string,
    payloadHash: string,
    actorId: string,
  ) {
    const existing = await this.prisma.workOrderMutation.findUnique({ where: { idempotencyKey: key } });
    return this.assertWorkOrderMutation(existing, workOrderId, operation, payloadHash, actorId);
  }

  private async findWorkOrderMutationInTx(
    tx: Prisma.TransactionClient,
    key: string,
    workOrderId: string,
    operation: string,
    payloadHash: string,
    actorId: string,
  ) {
    const existing = await tx.workOrderMutation.findUnique({ where: { idempotencyKey: key } });
    return this.assertWorkOrderMutation(existing, workOrderId, operation, payloadHash, actorId);
  }

  private assertWorkOrderMutation(
    existing: { workOrderId: string; operation: string; payloadHash: string; actorId: string; result: unknown } | null,
    workOrderId: string,
    operation: string,
    payloadHash: string,
    actorId: string,
  ) {
    if (!existing) return null;
    if (
      existing.workOrderId !== workOrderId ||
      existing.operation !== operation ||
      existing.payloadHash !== payloadHash ||
      existing.actorId !== actorId
    ) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSE',
        message: 'Idempotency key was already used for a different Work Order mutation.',
      });
    }
    return existing.result as AdminWorkOrderDetailDto;
  }

  private async persistWorkOrderMutation(
    tx: Prisma.TransactionClient,
    input: { idempotencyKey: string; workOrderId: string; operation: string; payloadHash: string; actorId: string },
  ) {
    const row = await tx.workOrder.findUnique({ where: { id: input.workOrderId }, include: detailInclude });
    if (!row) throw new NotFoundException('Work Order not found');
    const result = toAdminDetail(row);
    await tx.workOrderMutation.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        workOrderId: input.workOrderId,
        operation: input.operation,
        payloadHash: input.payloadHash,
        actorId: input.actorId,
        result: result as unknown as Prisma.InputJsonValue,
      },
    });
    return result;
  }

  /**
   * D1 / UX-5-002 (stage 3): every open Work Order and every Truck still Ready to Go (its latest
   * completed Work Order, not Returned to Service, no newer open one), each with the one Next step.
   * The Dashboard groups them by what the Manager has to do; nothing is cut at eight.
   */
  private async getDashboardQueue(openWhere: Prisma.WorkOrderWhereInput): Promise<AdminWorkOrderSummaryDto[]> {
    const since = yardReadyToGoSince();
    // PF9: open and recently completed rows do not depend on each other.
    const [openRows, completedRows] = await Promise.all([
      this.prisma.workOrder.findMany({
        where: openWhere,
        include: summaryInclude,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: DASHBOARD_QUEUE_LIMIT,
      }),
      since
        ? this.prisma.workOrder.findMany({
            where: { status: WorkOrderStatus.completed, completedAt: { gte: since } },
            include: summaryInclude,
            orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
            take: DASHBOARD_QUEUE_LIMIT,
          })
        : Promise.resolve([]),
    ]);
    const open = openRows ?? [];
    const completed = completedRows ?? [];
    const trucksWithOpenWork = new Set(open.map((row) => row.truckId));
    const seenTrucks = new Set<string>();
    const readyToGo = completed.filter((row) => {
      // Only the latest completed Work Order of a Truck, and only while the Truck has no open one.
      if (seenTrucks.has(row.truckId) || trucksWithOpenWork.has(row.truckId)) return false;
      seenTrucks.add(row.truckId);
      return keepsTruckReadyToGo(row.completedAt, row.serviceStatusEvents);
    });
    return [...open, ...readyToGo].map(toAdminSummary).filter((item) => Boolean(item.nextStep));
  }

  private async getAttention(openWhere: Prisma.WorkOrderWhereInput) {
    const base = { include: summaryInclude, take: ATTENTION_LIMIT } as const;
    const [critical, high, paused, stale, readyToClose, blocked] = await Promise.all([
      this.prisma.workOrder.findMany({
        ...base,
        where: { ...openWhere, priority: Priority.critical },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.workOrder.findMany({
        ...base,
        where: { ...openWhere, priority: Priority.high },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.workOrder.findMany({
        ...base,
        where: {
          ...openWhere,
          status: WorkOrderStatus.waiting_paused,
          priority: { notIn: [Priority.critical, Priority.high] },
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.workOrder.findMany({
        ...base,
        where: {
          ...openWhere,
          status: { in: [WorkOrderStatus.created, WorkOrderStatus.in_progress] },
          priority: { notIn: [Priority.critical, Priority.high] },
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.workOrder.findMany({
        ...base,
        where: {
          ...openWhere,
          status: WorkOrderStatus.in_progress,
          // LTR-97: PM Work Orders have no Jobs, so "none to do" matched them and
          // ranked every running PM above real ready-to-close Standard work.
          primaryCategory: { name: { not: 'PM' } },
          jobs: { some: { status: JobStatus.completed }, none: { status: JobStatus.to_do } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
      // LTR-121: an active mechanic-reported blocker (LTR-98) also needs attention.
      this.prisma.workOrder.findMany({
        ...base,
        where: {
          ...openWhere,
          pauseEvents: { some: { isOfficialPause: false, resolvedAt: null } },
        },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    // LTR-121: one ranking (shared) for every surface; within a reason keep query order.
    const candidates = uniqueWorkOrders([readyToClose, critical, high, paused, blocked, stale], Number.MAX_SAFE_INTEGER)
      .map(toAdminSummary);
    return candidates
      // LTR-116: nothing actionable (e.g. a fresh PM service) is not attention.
      .filter((item) => item.attentionReason !== null)
      .map((item, index) => ({ item, index, rank: workOrderAttentionRank(item.attentionReason ?? null) }))
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .slice(0, ATTENTION_LIMIT)
      .map(({ item }) => item);
  }

  private buildWhere(query: AdminWorkOrdersQuery, cursor: AdminWorkOrderCursor | null) {
    const filters: Prisma.WorkOrderWhereInput[] = [];
    if (query.status) filters.push({ status: { in: query.status as WorkOrderStatus[] } });
    if (query.priority) filters.push({ priority: { in: query.priority as Priority[] } });
    if (query.createdBefore) filters.push({ createdAt: { lt: new Date(query.createdBefore) } });
    if (query.completedFrom) filters.push({ completedAt: { gte: new Date(query.completedFrom) } });
    if (query.completedBefore) filters.push({ completedAt: { lt: new Date(query.completedBefore) } });
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      filters.push({ OR: [
        { displayId: contains },
        { truck: { truckNumber: contains } },
        { primaryCategory: { name: contains } },
        { mechanics: { some: { removedAt: null, mechanic: { name: contains } } } },
      ] });
    }
    if (cursor) {
      const comparison = query.direction === 'asc' ? 'gt' : 'lt';
      const value = query.sort === 'displayId' ? cursor.value : new Date(cursor.value);
      filters.push({ OR: [
        { [query.sort]: { [comparison]: value } },
        { [query.sort]: value, id: { [comparison]: cursor.id } },
      ] });
    }
    return filters.length ? { AND: filters } satisfies Prisma.WorkOrderWhereInput : {};
  }

  private buildMechanicWhere(query: AdminMechanicsQuery, cursor: AdminMechanicCursor | null): Prisma.UserWhereInput {
    const filters: Prisma.UserWhereInput[] = [query.assignable ? mechanicCapabilityWhere : rosterCapabilityWhere];
    if (query.assignable) filters.push({ role: { not: 'admin' } });
    // LTR-199 / D31: a removed person shows only under the Removed filter; Active and Inactive are the Shop's people.
    const status = query.status ?? (query.includeInactive ? 'all_in_shop' : 'active');
    if (status === 'removed') filters.push({ removedAt: { not: null } });
    else if (status !== 'all') filters.push({ removedAt: null });
    if (status === 'active') filters.push({ active: true });
    if (status === 'inactive') filters.push({ active: false });
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      filters.push({ OR: [{ name: contains }, { email: contains }] });
    }
    if (cursor) {
      const comparison = query.direction === 'asc' ? 'gt' : 'lt';
      filters.push({
        OR: [
          { name: { [comparison]: cursor.name } },
          { name: cursor.name, id: { [comparison]: cursor.id } },
        ],
      });
    }
    return { AND: filters };
  }

  private decodeMechanicCursor(encoded: string, query: AdminMechanicsQuery) {
    try {
      const decoded: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      const cursor = adminMechanicCursorSchema.parse(decoded);
      if (cursor.direction !== query.direction) throw new Error('mismatch');
      return cursor;
    } catch {
      throw new BadRequestException('Invalid or incompatible cursor');
    }
  }

  private encodeMechanicCursor(row: { id: string; name: string }, query: AdminMechanicsQuery) {
    return Buffer.from(JSON.stringify({ direction: query.direction, name: row.name, id: row.id })).toString('base64url');
  }

  private buildTruckWhere(query: AdminTrucksQuery, cursor: AdminTruckCursor | null): Prisma.TruckWhereInput {
    const filters: Prisma.TruckWhereInput[] = [];
    // D44: deactivated trucks are hidden unless the Manager asks for them (Inactive or All).
    if (query.status === 'active') filters.push({ deactivatedAt: null });
    if (query.status === 'inactive') filters.push({ deactivatedAt: { not: null } });
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      filters.push({
        OR: [
          { truckNumber: contains },
          { make: contains },
          { model: contains },
          { company: contains },
        ],
      });
    }
    if (cursor) {
      const comparison = query.direction === 'asc' ? 'gt' : 'lt';
      filters.push({
        OR: [
          { truckNumber: { [comparison]: cursor.truckNumber } },
          { truckNumber: cursor.truckNumber, id: { [comparison]: cursor.id } },
        ],
      });
    }
    return filters.length ? { AND: filters } : {};
  }

  private decodeTruckCursor(encoded: string, query: AdminTrucksQuery) {
    try {
      const decoded: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      const cursor = adminTruckCursorSchema.parse(decoded);
      if (cursor.direction !== query.direction) throw new Error('mismatch');
      return cursor;
    } catch {
      throw new BadRequestException('Invalid or incompatible cursor');
    }
  }

  private encodeTruckCursor(row: { id: string; truckNumber: string }, query: AdminTrucksQuery) {
    return Buffer.from(JSON.stringify({ direction: query.direction, truckNumber: row.truckNumber, id: row.id })).toString('base64url');
  }

  private decodeCursor(encoded: string, query: AdminWorkOrdersQuery) {
    try {
      const decoded: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      const cursor = adminWorkOrderCursorSchema.parse(decoded);
      if (cursor.sort !== query.sort || cursor.direction !== query.direction) throw new Error('mismatch');
      if (query.sort !== 'displayId' && Number.isNaN(Date.parse(cursor.value))) throw new Error('date');
      return cursor;
    } catch {
      throw new BadRequestException('Invalid or incompatible cursor');
    }
  }

  private encodeCursor(row: SummaryRow, query: AdminWorkOrdersQuery) {
    const value = query.sort === 'displayId' ? row.displayId : row[query.sort].toISOString();
    return Buffer.from(JSON.stringify({ sort: query.sort, direction: query.direction, value, id: row.id }))
      .toString('base64url');
  }
}

function toAdminSummary(row: SummaryRow): AdminWorkOrderSummaryDto {
  const jobs = row.primaryCategory.name === 'PM' ? [] : row.jobs.filter((job) => job.status !== 'cancelled');
  const currentPause = row.pauseEvents.find((pause) => !pause.endedAt && pause.isOfficialPause !== false) ?? null;
  // LTR-98 / D3: only an unresolved blocker is "latest reported" (active).
  const latestReportedBlocker = row.pauseEvents.find((pause) => pause.isOfficialPause === false && !pause.resolvedAt) ?? null;
  return {
    id: row.id,
    displayId: row.displayId,
    truck: {
      id: row.truck.id,
      truckNumber: row.truck.truckNumber,
      make: row.truck.make,
      model: row.truck.model,
      year: row.truck.year,
    },
    category: { id: row.primaryCategory.id, name: row.primaryCategory.name },
    status: row.status as SharedWorkOrderStatus,
    priority: row.priority as SharedPriority,
    jobsCompleted: jobs.filter((job) => job.status === 'completed').length,
    jobsTotal: jobs.length,
    // LTR-164 (#11) / D11: the team includes every Job owner, the PM mechanic too.
    mechanics: workOrderTeam(row.mechanics, row.jobs, row.createdAt).map((member) => ({
      mechanicId: member.mechanicId,
      mechanicName: member.mechanicName,
      addedAt: member.addedAt.toISOString(),
      removedAt: null,
    })),
    currentPause: currentPause ? mapPause(currentPause) : null,
    latestReportedBlocker: latestReportedBlocker
      ? { ...mapPause(latestReportedBlocker), ...blockerLogDetails(latestReportedBlocker.id, row.activityLogs) }
      : null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    attentionReason: workOrderAttentionReason({
      status: row.status,
      priority: row.priority,
      categoryName: row.primaryCategory.name,
      jobsCompleted: jobs.filter((job) => job.status === 'completed').length,
      jobsTotal: jobs.length,
      hasActiveBlocker: Boolean(latestReportedBlocker),
      unassignedJobs: countUnassignedJobs(jobs),
      createdAt: row.createdAt,
    }),
    nextJobName: nextJobInFlow(jobs),
    // LTR-159 / LTR-182: same Next step as Truck Detail and the Yard, including
    // "Return to Service" while a completed Work Order keeps the truck Ready to Go.
    nextStep: row.status === 'completed' && !keepsTruckReadyToGo(row.completedAt, row.serviceStatusEvents)
      ? null
      : workOrderNextStep(row, {
          inspectionRequirementOutcome: activeInspectionOutcome(row.truck),
          returnedToService: Boolean(row.serviceStatusEvents?.[0]),
        }),
  };
}

// LTR-164 / D15: Quality Check never has an owner, so it is not an unassigned Job.
// LTR-188 / D24: neither is a Job at an external shop (no owner on purpose).
export function countUnassignedJobs(
  jobs: Array<{ status: string; assignedMechanicId?: string | null; displayName?: string; category?: { name: string }; externalSince?: Date | null; workflowStepKey?: string | null; systemKey?: string | null }>,
): number {
  // LTR-197 / D28: a Job waiting in its team queue is not unassigned either.
  return jobs.filter((job) => job.status === 'to_do'
    && !job.assignedMechanicId
    && !job.externalSince
    && !job.workflowStepKey
    && classifyWorkPlanLane(job.category?.name ?? '', job.displayName ?? '', job.systemKey) !== WorkPlanJobLane.QUALITY_CHECK).length;
}

// LTR-157: flow order for "Next: <Job>" on lists and cards.
const LANE_FLOW_ORDER = ['inspection', 'shop_work', 'pm', 'alignment', 'detailing', 'quality_check'];

function nextJobInFlow(jobs: Array<{ status: string; displayName?: string; category?: { name: string }; externalSince?: Date | null; systemKey?: string | null }>): string | null {
  const pending = jobs
    .map((job, index) => ({ job, index, rank: LANE_FLOW_ORDER.indexOf(classifyWorkPlanLane(job.category?.name ?? '', job.displayName ?? '', job.systemKey)) }))
    // LTR-188 / D24: a Job at an external shop is not the next thing done here.
    .filter(({ job }) => job.status === 'to_do' && !job.externalSince)
    .sort((left, right) => left.rank - right.rank || left.index - right.index);
  return pending[0]?.job.displayName ?? null;
}

const logAction = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>).action : undefined);

function jobCompletionNotes(
  activityLogs: Array<{ eventType: string; entityId: string | null; newValue: unknown }>,
  jobId: string,
): string | null {
  const entry = activityLogs.find((event) => (
    event.eventType === SharedActivityEventType.JOB_COMPLETED && event.entityId === jobId
  ));
  const notes = (entry?.newValue as { notes?: unknown } | null)?.notes;
  return typeof notes === 'string' && notes.trim() ? notes : null;
}

function toAdminDetail(row: DetailRow): AdminWorkOrderDetailDto {
  const summary = toAdminSummary(row);
  const jobs = row.primaryCategory.name === 'PM' ? [] : row.jobs.map((job) => ({
    id: job.id,
    catalogJobId: job.catalogJobId ?? null,
    displayName: job.displayName,
    customDescription: job.customDescription,
    status: job.status as SharedJobStatus,
    category: { id: job.categoryId, name: job.category.name },
    assignedMechanic: job.assignedMechanic
      ? { id: job.assignedMechanic.id, name: job.assignedMechanic.name }
      : null,
    completedAt: job.completedAt?.toISOString() ?? null,
    completedBy: job.completedBy ?? null,
    completionNotes: jobCompletionNotes(row.activityLogs, job.id),
    // Stage 8: the reason shows on the cancelled row (it is stored on the Job).
    cancelledReason: job.status === 'cancelled' ? job.cancelledReason ?? null : null,
    startedAt: job.startedAt?.toISOString() ?? null,
    helperOfJobId: job.helperOfJobId ?? null,
    external: toJobExternalDto(job),
    // LTR-197 / D28: an unowned Job born in a team queue reads "In team queue", not "Unassigned".
    workflowStepKey: job.workflowStepKey ?? null,
    outsideInvoices: (job.outsideRepairs ?? []).map((repair) => ({ id: repair.id, amountCents: repair.amountCents, vendorName: repair.vendor.name })),
    parts: (job.purchaseLines ?? []).map((line) => ({
      purchaseId: line.purchaseId,
      description: line.description,
      partNumber: line.partNumber,
      quantity: line.quantity.toFixed(2),
      vendorName: line.purchase.vendor.name,
      lineTotalCents: line.lineTotalCents,
    })),
    // PCA3 (UX-10-001): the outside shop's invoice usually arrives after "Returned"; the Job keeps offering to load it.
    wentExternal: Boolean(job.externalSince) || row.activityLogs.some((entry) => entry.entityId === job.id && logAction(entry.relevantValue) === 'job_sent_external'),
  }));
  return {
    ...summary,
    truck: toTruckDto(row.truck),
    version: row.version,
    notes: row.notes,
    createdBy: row.createdBy,
    completedBy: row.completedBy,
    // LTR-94: live totals from persisted segments (open session/pause counted to now).
    ...liveTotals(row),
    jobs,
    laborSessions: row.sessions.map((session) => ({
      id: session.id,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      durationMs: sessionDurationMs(session.startedAt, session.endedAt),
      mechanic: session.user ? { id: session.user.id, name: session.user.name } : null,
      endReason: session.endReason ?? null,
    })),
    pauseHistory: row.pauseEvents
      .filter((pause) => pause.isOfficialPause !== false)
      .map((pause) => ({ ...mapPause(pause), createdBy: pause.createdBy })),
    reportedBlockers: row.pauseEvents
      .filter((pause) => pause.isOfficialPause === false)
      .map((pause) => ({ ...mapPause(pause), createdBy: pause.createdBy, ...blockerLogDetails(pause.id, row.activityLogs) })),
    // Deprecated (LTR-150): always true; kept for web/API deploy skew.
    addWorkInWorkPlan: true,
    pmService: row.pmService
      ? { observedMileage: row.pmService.observedMileage, partsCount: row.pmService._count.parts, workOrderJobId: row.pmService.workOrderJobId }
      : null,
    noteEntries: (row.noteEntries ?? []).map((note) => toWorkOrderNoteDto(note) as WorkOrderNoteDto),
    activityLog: row.activityLogs.map((entry) => ({
      id: entry.id,
      eventType: entry.eventType as SharedActivityEventType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      user: entry.user,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      relevantValue: entry.relevantValue,
      createdAt: entry.createdAt.toISOString(),
    })),
    returnedToServiceAt: row.serviceStatusEvents[0]?.occurredAt.toISOString() ?? null,
    // LTR-159: the Work Order detail says the same Next step as its Truck.
    nextStep: workOrderNextStep(row, {
      inspectionRequirementOutcome: activeInspectionOutcome(row.truck),
      returnedToService: Boolean(row.serviceStatusEvents[0]),
    }),
  };
}

function toMechanicAssignment(assignment: {
  workOrder: {
    id: string;
    displayId: string;
    status: WorkOrderStatus;
    truck: { truckNumber: string };
    primaryCategory: { name: string };
  };
}): import('@ltl-shop/shared').AdminMechanicAssignmentDto {
  return {
    workOrderId: assignment.workOrder.id,
    displayId: assignment.workOrder.displayId,
    truckNumber: assignment.workOrder.truck.truckNumber,
    status: assignment.workOrder.status as SharedWorkOrderStatus,
    primaryCategoryName: assignment.workOrder.primaryCategory.name,
  };
}

function toMechanicSummary(row: {
  id: string;
  name: string;
  email: string;
  role: import('@prisma/client').UserRole;
  active: boolean;
  capabilities: { capability: AppCapability }[];
  assignedJobs: Parameters<typeof toMechanicAssignment>[0][];
  removedAt?: Date | null;
  workflowStepMemberships?: Array<{ step: { stepKey: string; sortOrder: number } }>;
}): import('@ltl-shop/shared').AdminMechanicSummaryDto {
  // One row per open Work Order where the person still has a Job to do (ME1).
  const byWorkOrder = new Map<string, Parameters<typeof toMechanicAssignment>[0]>();
  for (const job of row.assignedJobs) {
    if (!byWorkOrder.has(job.workOrder.id)) byWorkOrder.set(job.workOrder.id, job);
  }
  const currentAssignments = [...byWorkOrder.values()].map(toMechanicAssignment);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as import('@ltl-shop/shared').UserRole,
    active: row.active,
    capabilities: row.capabilities.map((item) => toSharedCapability(item.capability)),
    openWorkOrderCount: currentAssignments.length,
    currentAssignments,
    pendingJobCount: row.assignedJobs.length,
    teamStepKeys: (row.workflowStepMemberships ?? [])
      .map((membership) => membership.step)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((step) => step.stepKey),
    removedAt: row.removedAt?.toISOString() ?? null,
  };
}

/**
 * LTR-199 / D31: how much a person left in the Shop's records — Jobs they owned, added or completed, Work Orders,
 * notes, time, blockers, team memberships of Work Orders and the Activity Log. Zero means they can be deleted.
 */
export async function personHistoryCount(
  prisma: Pick<PrismaService, 'workOrderJob' | 'workOrder' | 'workOrderNote' | 'workSession' | 'activityLog' | 'mechanicAssignment' | 'pauseEvent' | 'truckServiceStatusEvent' | 'truckReadinessAssessment' | 'truckMileageAdjustment' | 'catalogJob'>,
  id: string,
) {
  const counts = await Promise.all([
    prisma.workOrderJob.count({ where: { OR: [{ assignedMechanicId: id }, { addedById: id }, { completedById: id }] } }),
    prisma.workOrder.count({ where: { OR: [{ createdById: id }, { completedById: id }] } }),
    prisma.workOrderNote.count({ where: { authorId: id } }),
    prisma.workSession.count({ where: { userId: id } }),
    prisma.activityLog.count({ where: { userId: id } }),
    prisma.mechanicAssignment.count({ where: { mechanicId: id } }),
    prisma.pauseEvent.count({ where: { OR: [{ createdById: id }, { reportedById: id }, { resolvedById: id }] } }),
    prisma.truckServiceStatusEvent.count({ where: { actorId: id } }),
    prisma.truckReadinessAssessment.count({ where: { OR: [{ startedById: id }, { approvedById: id }, { closedById: id }] } }),
    prisma.truckMileageAdjustment.count({ where: { createdById: id } }),
    prisma.catalogJob.count({ where: { createdById: id } }),
  ]);
  return counts.reduce((sum, count) => sum + count, 0);
}

function toTruckSummary(row: {
  id: string;
  truckNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  company: string | null;
  owner: string | null;
  workOrders: Array<NextStepWorkOrderRow & {
    id: string;
    displayId: string;
    status: WorkOrderStatus;
    completedAt?: Date | null;
    primaryCategory: { name: string };
  }>;
  serviceStatusEvents: { status: string; occurredAt: Date }[];
  readinessAssessments?: Array<{ requirements: Array<{ outcome: string }> }>;
  faults?: Array<{ severity: TruckFaultSeverity }>;
  samsaraVehicleId?: string | null;
  samsaraProposedVehicleId?: string | null;
}): AdminTruckSummaryDto {
  const open = row.workOrders.find((item) => (OPEN_WORK_ORDER_STATUSES as string[]).includes(item.status)) ?? null;
  const latestEvent = row.serviceStatusEvents[0] ?? null;
  // LTR-182: like Truck Detail, a completed Work Order keeps the truck Ready to Go until Return to Service.
  const readyToGo = open ? null : row.workOrders.find((item) =>
    item.status === 'completed' && !returnedToServiceAfter(latestEvent, item.completedAt ?? null)) ?? null;
  const operational = derivedOperationalStatus(row.serviceStatusEvents);
  return {
    // LTR-159: the same Next step as Truck Detail (no Work Order → create one).
    nextStep: open
      ? workOrderNextStep(open, { inspectionRequirementOutcome: activeInspectionOutcome(row) })
      : readyToGo
        ? workOrderNextStep(readyToGo, { returnedToService: false })
        : { kind: 'create_work_order' },
    truck: toTruckDto(row),
    // S3-4: the dash lights first, then codes that lit check engine (info and pending stay on the Faults tab).
    ...(row.faults ? { faults: { active: row.faults.length, worst: truckAttention(toTruckDto(row).samsara?.lamps, row.faults.map((fault) => fault.severity)) } } : {}),
    operationalStatus: operational.status,
    operationalStatusAt: operational.at,
    openWorkOrder: open
      ? {
          id: open.id,
          displayId: open.displayId,
          status: open.status as SharedWorkOrderStatus,
          primaryCategoryName: open.primaryCategory.name,
        }
      : null,
    // D44: "Samsara: proposed" on the row while the Manager has not connected it.
    samsaraProposedVehicleId: row.samsaraVehicleId ? null : row.samsaraProposedVehicleId ?? null,
  };
}

function derivedOperationalStatus(events: { status: string; occurredAt: Date }[]): {
  status: TruckOperationalStatus;
  at: string | null;
} {
  const latest = events[0];
  if (!latest) return { status: TruckOperationalStatus.UNKNOWN, at: null };
  if (latest.status === 'in_service') {
    return { status: TruckOperationalStatus.IN_SERVICE, at: latest.occurredAt.toISOString() };
  }
  if (latest.status === 'off_duty') {
    return { status: TruckOperationalStatus.OFF_DUTY, at: latest.occurredAt.toISOString() };
  }
  return { status: TruckOperationalStatus.UNKNOWN, at: null };
}

function toCatalogCategorySummary(row: {
  id: string;
  name: string;
  status: string;
  sortOrder: number;
  systemKey?: string | null;
  inactiveReason?: string | null;
  catalogJobs: { status: string; systemKey?: string | null; _count: { aliases: number } }[];
}): AdminCatalogCategorySummaryDto {
  return {
    id: row.id,
    name: row.name,
    status: row.status as CatalogStatus,
    sortOrder: row.sortOrder,
    activeJobCount: row.catalogJobs.filter((job) => job.status === 'active').length,
    inactiveJobCount: row.catalogJobs.filter((job) => job.status === 'inactive').length,
    aliasCount: row.catalogJobs.reduce((total, job) => total + job._count.aliases, 0),
    // LTR-198 / D30, D-SET9.
    systemKey: row.systemKey ?? null,
    inactiveReason: row.inactiveReason ?? null,
    holdsSystemJob: row.catalogJobs.some((job) => Boolean(job.systemKey)),
  };
}

function mapPause(pause: {
  id: string; workOrderId: string; reason: PauseReason; notes: string | null;
  startedAt: Date; endedAt: Date | null; durationMs: bigint | null;
  isOfficialPause?: boolean;
  reportedBy?: { id: string; name: string } | null;
  resolvedAt?: Date | null;
  resolvedBy?: { id: string; name: string } | null;
  job?: { id: string; displayName: string } | null;
  blockerReason?: string | null;
}) {
  return {
    // LTR-155 / D17: which Job is blocked and why (mechanic reasons).
    job: pause.job ?? null,
    blockerReason: (pause.blockerReason ?? null) as SharedBlockerReason | null,
    id: pause.id,
    workOrderId: pause.workOrderId,
    reason: pause.reason as SharedPauseReason,
    notes: pause.notes,
    startedAt: pause.startedAt.toISOString(),
    endedAt: pause.endedAt?.toISOString() ?? null,
    durationMs: pause.durationMs === null ? null : Number(pause.durationMs),
    isOfficialPause: pause.isOfficialPause !== false,
    reportedBy: pause.reportedBy ?? null,
    resolvedAt: pause.resolvedAt?.toISOString() ?? null,
    resolvedBy: pause.resolvedBy ?? null,
  };
}

function liveTotals(row: {
  sessions: { startedAt: Date; endedAt: Date | null }[];
  pauseEvents: { startedAt: Date; endedAt: Date | null; isOfficialPause?: boolean | null }[];
}) {
  return computeTotals({ sessions: row.sessions, pauses: row.pauseEvents });
}
