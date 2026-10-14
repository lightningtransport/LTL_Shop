import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkOrderStatus } from '@prisma/client';
import {
  ActivityEventType,
  AppCapability,
  DEFAULT_INSPECTION_TIRE_LIMITS,
  InspectionItemResult,
  OPEN_WORK_ORDER_STATUSES,
  ShopWorkflowStepKey,
  TIRE_POSITIONS,
  TireReadingStatus,
  WorkOrderJobSourceKind,
  WorkPlanInspectionOutcome,
  WorkPlanJobLane,
  addInspectionDefectsSchema,
  saveInspectionChecklistSchema,
  saveInspectionSchema,
  tireReadingStatus,
  tireTargets,
  type InspectionChecklistDto,
  type InspectionChecklistItemDto,
  type InspectionQueueItemDto,
  type InspectionSection,
  type InspectionTireLimits,
  type TireReadingDto,
  type TruckInspectionDto,
  type TruckInspectionStateDto,
  type TirePosition,
} from '@ltl-shop/shared';
import { randomUUID } from 'node:crypto';
import { jobSeedKey } from '../../prisma/job-catalog';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { hasCapability } from '../auth/capabilities';
import { canDoManagerWrites } from '../auth/manager-writes.guard';
import { idempotencyFingerprint } from '../common/idempotency';
import { lockTruckMutation } from '../common/truck-mutation-lock';
import { PrismaService } from '../prisma/prisma.service';
import { joinWorkOrderTeam } from '../work-orders/work-order-team';
import { classifyWorkPlanLane } from '../admin/yard-work-plan-derivation';
import { YardWorkPlanService, childIdempotencyKey } from '../admin/yard-work-plan.service';
import { InspectionPlanError, planInspectionFindings, type InspectionPlan, type PlanFinding } from './inspection-plan';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIRES_CATEGORY = 'Tires & Wheels';
const OPEN = OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[];
const SAVE_OPERATION = 'inspection_save';
const ADD_OPERATION = 'inspection_add_defects';

type Actor = 'manager' | 'mechanic';
type Tx = Prisma.TransactionClient;

const checklistInclude = { catalogJob: { select: { id: true, displayName: true, status: true, category: { select: { name: true } } } } } as const;
type ChecklistRow = Prisma.InspectionChecklistItemGetPayload<{ include: typeof checklistInclude }>;

const inspectionInclude = {
  inspectedBy: { select: { id: true, name: true, role: true } },
  workOrder: { select: { id: true, status: true } },
  items: {
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    include: { catalogJob: { select: { displayName: true, category: { select: { name: true } } } }, addedLaterBy: { select: { name: true } } },
  },
  tires: true,
} satisfies Prisma.TruckInspectionInclude;
type InspectionRow = Prisma.TruckInspectionGetPayload<{ include: typeof inspectionInclude }>;

/**
 * D41: the inspection sheet. The Manager always inspects; a Standard or PM mechanic with "Can inspect trucks"
 * (`inspection.perform`) does too, and the Jobs a mechanic's defects create are born unowned (the only exception
 * to A26). A saved inspection is never edited: "Add defects" only turns ok / n/a checks into defects.
 */
@Injectable()
export class InspectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly workPlan: YardWorkPlanService,
  ) {}

  actorOf(user: AuthUser): Actor | null {
    if (canDoManagerWrites(user)) return 'manager';
    const mechanic = hasCapability(user, AppCapability.MECHANIC_STANDARD) || hasCapability(user, AppCapability.MECHANIC_PM);
    return mechanic && hasCapability(user, AppCapability.INSPECTION_PERFORM) ? 'mechanic' : null;
  }

  private requireActor(user: AuthUser): Actor {
    const actor = this.actorOf(user);
    if (!actor) throw new ForbiddenException({ code: 'INSPECTION_NOT_ALLOWED', message: 'You cannot inspect trucks. The Manager turns it on in People.' });
    return actor;
  }

  // ───────────────────────── Reads ─────────────────────────

  async getState(user: AuthUser, truckId: string): Promise<TruckInspectionStateDto> {
    assertUuid(truckId, 'Invalid Truck id');
    const actor = this.actorOf(user);
    if (!actor && !hasCapability(user, AppCapability.ADMIN_ACCESS)) {
      throw new ForbiddenException({ code: 'INSPECTION_NOT_ALLOWED', message: 'You cannot inspect trucks.' });
    }
    const truck = await this.prisma.truck.findUnique({ where: { id: truckId }, select: { id: true, truckNumber: true, mileage: true } });
    if (!truck) throw new NotFoundException('Truck not found');
    const [workOrder, assessment, checklist, limits] = await Promise.all([
      this.openWorkOrder(this.prisma, truckId),
      this.activeAssessment(truckId),
      this.activeChecklist(this.prisma),
      this.limits(this.prisma),
    ]);
    const inspection = assessment
      ? await this.prisma.truckInspection.findUnique({ where: { assessmentId: assessment.id }, include: inspectionInclude })
      : null;
    // IN-8: an outcome recorded with the old buttons (before D41) and no sheet saved for this visit.
    const legacy = assessment && !inspection
      ? await this.prisma.readinessRequirement.findFirst({
          where: { assessmentId: assessment.id, type: 'inspection', outcome: { in: ['completed', 'required'] } },
          select: { outcome: true, evaluatedAt: true, evaluatedBy: { select: { name: true } } },
        })
      : null;
    const tireJobs = await this.prisma.catalogJob.findMany({
      where: { seedKey: { in: [jobSeedKey(TIRES_CATEGORY, 'Flat Repair'), jobSeedKey(TIRES_CATEGORY, 'Tires')] } },
      select: { id: true, displayName: true, seedKey: true, category: { select: { name: true } } },
    });
    const tireJob = (name: string) => {
      const row = tireJobs.find((job) => job.seedKey === jobSeedKey(TIRES_CATEGORY, name));
      return row ? { id: row.id, displayName: row.displayName, categoryName: row.category.name } : null;
    };
    const flatRepair = tireJob('Flat Repair');
    const tires = tireJob('Tires');
    const previous = await this.prisma.tireReading.findMany({
      where: { truckId, ...(inspection ? { inspectionId: { not: inspection.id } } : {}) },
      orderBy: { readAt: 'desc' },
      distinct: ['position'],
    });
    return {
      truck,
      workOrder: workOrder
        ? {
            id: workOrder.id,
            displayId: workOrder.displayId,
            status: workOrder.status,
            jobCatalogIds: [...new Set(workOrder.jobs.filter((job) => job.status !== 'cancelled' && !job.helperOfJobId && job.catalogJobId).map((job) => job.catalogJobId as string))],
          }
        : null,
      checklist: checklist.map(toChecklistItemDto),
      tireJobs: flatRepair && tires ? { flatRepair, tires } : null,
      limits,
      inspection: inspection ? await this.toInspectionDto(inspection) : null,
      previousTires: previous.map(toTireDto),
      canInspect: actor !== null,
      canAssign: actor === 'manager',
      legacyInspection: legacy
        ? {
            outcome: legacy.outcome === 'completed' ? 'no_issues_found' : 'issues_found',
            recordedAt: legacy.evaluatedAt?.toISOString() ?? null,
            byName: legacy.evaluatedBy?.name ?? null,
          }
        : null,
    };
  }

  /** HU-ME7: open Work Orders whose visit has no inspection yet (none from the sheet, none from the old buttons). */
  async queue(user: AuthUser): Promise<InspectionQueueItemDto[]> {
    this.requireActor(user);
    const rows = await this.prisma.workOrder.findMany({
      where: { status: { in: OPEN }, primaryCategory: { name: { not: 'PM' } } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        displayId: true,
        createdAt: true,
        truck: { select: { id: true, truckNumber: true, make: true, model: true, year: true } },
        readinessAssessment: {
          select: {
            status: true,
            inspection: { select: { id: true, inspectedById: true, inspectedAt: true } },
            requirements: { where: { type: 'inspection' }, select: { outcome: true } },
          },
        },
      },
    });
    // IN-7: besides the trucks waiting, the ones I inspected while their Work Order is open (to reach Add defects).
    const inspectedByMe = (row: (typeof rows)[number]) => {
      const inspection = row.readinessAssessment?.status !== 'closed' ? row.readinessAssessment?.inspection : null;
      return inspection && inspection.inspectedById === user.id ? inspection.inspectedAt : null;
    };
    return rows
      .filter((row) => {
        const assessment = row.readinessAssessment;
        if (!assessment || assessment.status === 'closed') return true;
        if (assessment.inspection) return Boolean(inspectedByMe(row));
        return (assessment.requirements[0]?.outcome ?? 'not_evaluated') === 'not_evaluated';
      })
      .map((row) => ({
        truckId: row.truck.id,
        truckNumber: row.truck.truckNumber,
        make: row.truck.make,
        model: row.truck.model,
        year: row.truck.year,
        workOrderId: row.id,
        workOrderDisplayId: row.displayId,
        waitingSince: row.createdAt.toISOString(),
        inspectedAt: inspectedByMe(row)?.toISOString() ?? null,
      }))
      // Waiting first (oldest first), then the ones already inspected.
      .sort((a, b) => Number(a.inspectedAt !== null) - Number(b.inspectedAt !== null));
  }

  // ───────────────────────── Save the sheet ─────────────────────────

  async save(user: AuthUser, truckId: string, raw: unknown): Promise<TruckInspectionStateDto> {
    assertUuid(truckId, 'Invalid Truck id');
    const actor = this.requireActor(user);
    const parsed = saveInspectionSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    if (actor === 'mechanic' && input.assignments?.length) {
      throw new ForbiddenException({ code: 'INSPECTION_ASSIGN_MANAGER_ONLY', message: 'The Manager assigns the Jobs a mechanic’s inspection creates.' });
    }
    const open = await this.requireOpenWorkOrder(this.prisma, truckId);
    const payloadHash = idempotencyFingerprint({ truckId, ...input });
    if (await this.replayed(input.idempotencyKey, SAVE_OPERATION, payloadHash, user.id)) return this.getState(user, truckId);

    const checklist = await this.activeChecklist(this.prisma);
    const answers = new Map(input.items.map((item) => [item.checklistItemId, item]));
    if (answers.size !== input.items.length) throw badRequest('INSPECTION_DUPLICATE_ANSWER', 'A check was answered twice.');
    const unknown = input.items.filter((item) => !checklist.some((row) => row.id === item.checklistItemId));
    if (unknown.length) throw badRequest('INSPECTION_CHECKLIST_CHANGED', 'The checklist changed while you were inspecting. Reload the sheet.');
    const missing = checklist.filter((row) => !answers.has(row.id)).length;
    if (missing) throw badRequest('INSPECTION_INCOMPLETE', `${missing} check${missing === 1 ? '' : 's'} not answered.`);
    const noNote = input.items.filter((item) => item.result === InspectionItemResult.DEFECT && !item.note?.trim()).length;
    if (noNote) throw badRequest('INSPECTION_DEFECT_NOTE_REQUIRED', `${noNote} defect${noNote === 1 ? '' : 's'} without a note.`);
    const positions = new Set(input.tires.map((tire) => tire.position));
    if (positions.size !== TIRE_POSITIONS.length) throw badRequest('INSPECTION_TIRES_INCOMPLETE', 'Every tire needs its pressure and tread.');

    const assessmentId = await this.workPlan.ensureInspectionAssessment(user, truckId, childIdempotencyKey(input.idempotencyKey, 0));
    const limits = await this.limits(this.prisma);
    const tireJobs = await this.tireJobIds();

    let issues: boolean | null = null;
    try {
      issues = await this.prisma.$transaction(async (tx) => {
        await lockTruckMutation(tx, truckId);
        // A retry that raced the first request: the first one records the outcome.
        if (await this.replayedInTx(tx, input.idempotencyKey, SAVE_OPERATION, payloadHash, user.id)) return null;
        const wo = await this.requireOpenWorkOrder(tx, truckId);
        if (wo.id !== open.id) throw new ConflictException({ code: 'VERSION_CONFLICT', message: 'The Work Order changed. Reload the sheet.' });
        const already = await tx.truckInspection.findUnique({ where: { assessmentId }, include: { inspectedBy: { select: { name: true } } } });
        if (already) {
          throw new ConflictException({ code: 'INSPECTION_ALREADY_SAVED', message: `Already inspected by ${already.inspectedBy.name}. Use Add defects for anything new.` });
        }
        const truck = await tx.truck.findUnique({ where: { id: truckId }, select: { mileage: true } });
        const inspectionId = randomUUID();
        await tx.truckInspection.create({
          data: { id: inspectionId, truckId, assessmentId, workOrderId: wo.id, inspectedById: user.id, mileage: truck?.mileage ?? null, notes: input.notes || null },
        });
        const itemRows = checklist.map((row) => {
          const answer = answers.get(row.id)!;
          return {
            id: randomUUID(),
            inspectionId,
            checklistItemId: row.id,
            section: row.section,
            label: row.label,
            sortOrder: row.sortOrder,
            catalogJobId: row.catalogJobId,
            workflowStepKey: row.workflowStepKey,
            result: answer.result,
            note: answer.note?.trim() || null,
          };
        });
        await tx.truckInspectionItem.createMany({ data: itemRows });
        const tireRows = input.tires.map((tire) => {
          const target = tireTargets(tire.position as TirePosition, limits);
          const { status, reason } = tireReadingStatus(tire, target, limits);
          return { id: randomUUID(), inspectionId, truckId, position: tire.position, psi: tire.psi, tread: tire.tread, ...target, status, reason };
        });
        await tx.tireReading.createMany({ data: tireRows.map(({ reason: _reason, ...row }) => row) });

        const findings: PlanFinding[] = [
          ...itemRows.filter((row) => row.result === InspectionItemResult.DEFECT).map((row) => ({
            catalogJobId: row.catalogJobId,
            workflowStepKey: row.workflowStepKey,
            source: { kind: WorkOrderJobSourceKind.INSPECTION_ITEM as const, inspectionItemId: row.id, note: `${row.label}: ${row.note}` },
          })),
          ...tireRows.filter((row) => row.status === TireReadingStatus.FIX).map((row) => ({
            catalogJobId: row.reason === 'tread' ? tireJobs.tires : tireJobs.flatRepair,
            workflowStepKey: null,
            source: { kind: WorkOrderJobSourceKind.TIRE_READING as const, tireReadingId: row.id, note: `Tire ${row.position}: ${row.psi} PSI (target ${row.targetPsi}) · tread ${row.tread}/32` },
          })),
        ];
        const summary = await this.applyFindings(tx, user, wo, findings, actor === 'manager' ? input.assignments ?? [] : []);
        await this.activity.log(tx, {
          workOrderId: wo.id,
          eventType: ActivityEventType.INSPECTION_SAVED,
          entityType: 'truck_inspection',
          entityId: inspectionId,
          userId: user.id,
          newValue: {
            inspectionId,
            byMechanic: actor === 'mechanic',
            defects: findings.filter((finding) => finding.source.kind === WorkOrderJobSourceKind.INSPECTION_ITEM).length,
            tiresToFix: tireRows.filter((row) => row.status === TireReadingStatus.FIX).length,
            tiresToWatch: tireRows.filter((row) => row.status === TireReadingStatus.WATCH).length,
            ...summary,
          },
        });
        await tx.workOrderMutation.create({
          data: { idempotencyKey: input.idempotencyKey, workOrderId: wo.id, operation: SAVE_OPERATION, payloadHash, actorId: user.id, result: { inspectionId } },
        });
        return findings.length > 0;
      });
    } catch (error) {
      throw translatePlanError(error);
    }

    if (issues !== null) {
      await this.workPlan.recordInspection(user, truckId, {
        outcome: issues ? WorkPlanInspectionOutcome.ISSUES_FOUND : WorkPlanInspectionOutcome.NO_ISSUES_FOUND,
        idempotencyKey: childIdempotencyKey(input.idempotencyKey, 1),
      }, { fromSheet: true });
    }
    return this.getState(user, truckId);
  }

  // ───────────────────────── Add defects later ─────────────────────────

  async addDefects(user: AuthUser, truckId: string, raw: unknown): Promise<TruckInspectionStateDto> {
    assertUuid(truckId, 'Invalid Truck id');
    const actor = this.requireActor(user);
    const parsed = addInspectionDefectsSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    if (actor === 'mechanic' && input.assignments?.length) {
      throw new ForbiddenException({ code: 'INSPECTION_ASSIGN_MANAGER_ONLY', message: 'The Manager assigns the Jobs a mechanic’s inspection creates.' });
    }
    const payloadHash = idempotencyFingerprint({ truckId, ...input });
    if (await this.replayed(input.idempotencyKey, ADD_OPERATION, payloadHash, user.id)) return this.getState(user, truckId);
    if (new Set(input.defects.map((defect) => defect.inspectionItemId)).size !== input.defects.length) {
      throw badRequest('INSPECTION_DUPLICATE_ANSWER', 'A check was added twice.');
    }
    const assessment = await this.activeAssessment(truckId);
    const inspection = assessment ? await this.prisma.truckInspection.findUnique({ where: { assessmentId: assessment.id }, select: { id: true } }) : null;
    if (!inspection) throw new NotFoundException({ code: 'INSPECTION_NOT_FOUND', message: 'This visit has no saved inspection yet.' });

    try {
      await this.prisma.$transaction(async (tx) => {
        await lockTruckMutation(tx, truckId);
        if (await this.replayedInTx(tx, input.idempotencyKey, ADD_OPERATION, payloadHash, user.id)) return;
        const wo = await this.openWorkOrder(tx, truckId);
        if (!wo) throw new ConflictException({ code: 'INSPECTION_WORK_ORDER_CLOSED', message: 'The Work Order is closed; add the work on a new visit.' });
        const items = await tx.truckInspectionItem.findMany({ where: { inspectionId: inspection.id, id: { in: input.defects.map((defect) => defect.inspectionItemId) } } });
        if (items.length !== input.defects.length) throw badRequest('INSPECTION_ITEM_NOT_FOUND', 'A check is not part of this inspection.');
        if (items.some((item) => item.result === 'defect')) {
          throw new ConflictException({ code: 'INSPECTION_ITEM_ALREADY_DEFECT', message: 'That check is already a defect.' });
        }
        const now = new Date();
        const noteOf = new Map(input.defects.map((defect) => [defect.inspectionItemId, defect.note.trim()]));
        for (const item of items) {
          await tx.truckInspectionItem.update({
            where: { id: item.id },
            data: { result: 'defect', note: noteOf.get(item.id), addedLaterAt: now, addedLaterById: user.id },
          });
        }
        const findings: PlanFinding[] = items.map((item) => ({
          catalogJobId: item.catalogJobId,
          workflowStepKey: item.workflowStepKey,
          source: { kind: WorkOrderJobSourceKind.INSPECTION_ITEM, inspectionItemId: item.id, note: `${item.label}: ${noteOf.get(item.id)}` },
        }));
        const summary = await this.applyFindings(tx, user, wo, findings, actor === 'manager' ? input.assignments ?? [] : []);
        await this.activity.log(tx, {
          workOrderId: wo.id,
          eventType: ActivityEventType.INSPECTION_DEFECTS_ADDED,
          entityType: 'truck_inspection',
          entityId: inspection.id,
          userId: user.id,
          newValue: { inspectionId: inspection.id, byMechanic: actor === 'mechanic', defects: items.length, ...summary },
        });
        await tx.workOrderMutation.create({
          data: { idempotencyKey: input.idempotencyKey, workOrderId: wo.id, operation: ADD_OPERATION, payloadHash, actorId: user.id, result: { inspectionId: inspection.id } },
        });
      });
    } catch (error) {
      throw translatePlanError(error);
    }

    await this.workPlan.recordInspection(user, truckId, {
      outcome: WorkPlanInspectionOutcome.ISSUES_FOUND,
      idempotencyKey: childIdempotencyKey(input.idempotencyKey, 1),
    }, { fromSheet: true });
    return this.getState(user, truckId);
  }

  /** Creates the merged Jobs and links every finding to its Job (D41 point 3). One version bump per Job changed. */
  private async applyFindings(
    tx: Tx,
    user: AuthUser,
    wo: OpenWorkOrder,
    findings: PlanFinding[],
    assignments: Array<{ catalogJobId: string; assignedMechanicId: string }>,
  ) {
    if (!findings.length) return { jobsCreated: 0, jobsUpdated: 0 };
    if (wo.primaryCategory.name === 'PM') throw new BadRequestException('PM Work Orders do not use jobs');
    const plan: InspectionPlan = planInspectionFindings(findings, wo.jobs.map((job) => ({
      id: job.id,
      catalogJobId: job.catalogJobId,
      status: job.status,
      helperOfJobId: job.helperOfJobId,
      isDetailing: job.workflowStepKey === ShopWorkflowStepKey.DETAILING
        || classifyWorkPlanLane(job.category.name, job.displayName, job.systemKey) === WorkPlanJobLane.DETAILING,
    })));
    const ownerOf = new Map(assignments.map((item) => [item.catalogJobId, item.assignedMechanicId]));
    const catalogJobs = await tx.catalogJob.findMany({
      where: { id: { in: plan.create.map((item) => item.catalogJobId) } },
      include: { category: { select: { id: true, name: true, status: true } } },
    });
    const owners = await this.standardMechanics(tx, plan.create.map((item) => ownerOf.get(item.catalogJobId)).filter((id): id is string => Boolean(id)));

    for (const item of plan.create) {
      const catalogJob = catalogJobs.find((row) => row.id === item.catalogJobId);
      if (!catalogJob || catalogJob.status !== 'active' || catalogJob.category.status !== 'active') {
        throw new ConflictException({ code: 'INSPECTION_JOB_INACTIVE', message: 'A check points to a Job that is no longer in the catalog. Fix it in Setup → Inspection checklist.' });
      }
      const ownerId = ownerOf.get(item.catalogJobId);
      const owner = ownerId ? owners.get(ownerId) : undefined;
      if (ownerId && !owner) throw new BadRequestException('One or more selected mechanics cannot perform standard work');
      const job = await tx.workOrderJob.create({
        data: {
          workOrderId: wo.id,
          catalogJobId: catalogJob.id,
          categoryId: catalogJob.category.id,
          displayName: catalogJob.displayName,
          customDescription: item.sources.map((source) => source.note).join('\n').slice(0, 500),
          isCustom: false,
          addedById: user.id,
          assignedMechanicId: owner?.id,
          status: 'to_do',
        },
      });
      if (owner) await joinWorkOrderTeam(tx, wo.id, owner.id, user.id);
      await this.linkSources(tx, job.id, item.sources, user.id);
      await this.activity.log(tx, {
        workOrderId: wo.id,
        eventType: ActivityEventType.JOB_ADDED,
        entityType: 'work_order_job',
        entityId: job.id,
        userId: user.id,
        newValue: { jobId: job.id, categoryId: catalogJob.category.id, categoryName: catalogJob.category.name, catalogJobId: catalogJob.id, displayName: job.displayName, isCustom: false, fromInspection: true },
      });
      if (owner) {
        await this.activity.log(tx, {
          workOrderId: wo.id,
          eventType: ActivityEventType.MECHANIC_ADDED,
          entityType: 'work_order_job',
          entityId: job.id,
          userId: user.id,
          previousValue: { jobId: job.id, assignedMechanicId: null },
          newValue: { jobId: job.id, action: 'job_assigned', assignedMechanicId: owner.id, mechanicName: owner.name },
        });
      }
    }
    for (const item of plan.attach) await this.linkSources(tx, item.jobId, item.sources, user.id);
    await tx.workOrder.update({ where: { id: wo.id }, data: { version: { increment: plan.create.length + plan.attach.length } } });
    return { jobsCreated: plan.create.length, jobsUpdated: plan.attach.length };
  }

  private async linkSources(tx: Tx, workOrderJobId: string, sources: InspectionPlan['create'][number]['sources'], createdById: string) {
    await tx.workOrderJobSource.createMany({
      data: sources.map((source) => ({
        workOrderJobId,
        kind: source.kind,
        inspectionItemId: source.kind === WorkOrderJobSourceKind.INSPECTION_ITEM ? source.inspectionItemId : null,
        tireReadingId: source.kind === WorkOrderJobSourceKind.TIRE_READING ? source.tireReadingId : null,
        note: source.note.slice(0, 1000),
        createdById,
      })),
      skipDuplicates: true,
    });
  }

  // ───────────────────────── Setup → Inspection checklist ─────────────────────────

  async getChecklist(user: AuthUser): Promise<InspectionChecklistDto> {
    const [items, limits, jobs] = await Promise.all([
      this.prisma.inspectionChecklistItem.findMany({ include: checklistInclude, orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }] }),
      this.limits(this.prisma),
      this.prisma.catalogJob.findMany({
        where: { status: 'active', category: { status: 'active' } },
        select: { id: true, displayName: true, category: { select: { name: true, sortOrder: true } } },
        orderBy: [{ category: { sortOrder: 'asc' } }, { displayName: 'asc' }],
      }),
    ]);
    return {
      items: items.map(toChecklistItemDto),
      limits,
      canEdit: canDoManagerWrites(user),
      catalogJobs: jobs.map((job) => ({ id: job.id, displayName: job.displayName, categoryName: job.category.name })),
    };
  }

  /**
   * HU-M17: saves the whole list at once (the array order is the order in each section) and the tire limits.
   * Checks are never deleted, only deactivated, so saved inspections keep their history. Saved inspections hold a
   * copy of each check, so editing never changes them.
   */
  async saveChecklist(user: AuthUser, raw: unknown): Promise<InspectionChecklistDto> {
    const parsed = saveInspectionChecklistSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.inspectionChecklistItem.findMany({ select: { id: true, catalogJobId: true } });
      const sent = new Set(input.items.map((item) => item.id).filter(Boolean));
      if (existing.some((row) => !sent.has(row.id))) throw badRequest('CHECKLIST_INCOMPLETE', 'Send every check; deactivate a check instead of leaving it out.');
      if (input.items.some((item) => item.id && !existing.some((row) => row.id === item.id))) throw badRequest('CHECKLIST_ITEM_NOT_FOUND', 'A check does not exist.');
      const jobIds = [...new Set(input.items.filter((item) => item.active && item.catalogJobId).map((item) => item.catalogJobId as string))];
      const jobs = await tx.catalogJob.findMany({ where: { id: { in: jobIds }, status: 'active', category: { status: 'active' } }, select: { id: true } });
      if (jobs.length !== jobIds.length) throw badRequest('CHECKLIST_JOB_INACTIVE', 'An active check points to a Job that is not active in the catalog.');
      const order = new Map<string, number>();
      for (const item of input.items) {
        const sortOrder = ((order.get(item.section) ?? 0) + 1);
        order.set(item.section, sortOrder);
        const data = {
          section: item.section,
          label: item.label,
          sortOrder: sortOrder * 10,
          catalogJobId: item.catalogJobId,
          workflowStepKey: item.workflowStepKey,
          active: item.active,
          updatedById: user.id,
        };
        if (item.id) await tx.inspectionChecklistItem.update({ where: { id: item.id }, data });
        else await tx.inspectionChecklistItem.create({ data });
      }
      await tx.inspectionSettings.upsert({
        where: { id: 1 },
        create: { id: 1, ...input.limits, updatedById: user.id },
        update: { ...input.limits, updatedById: user.id },
      });
      await this.activity.log(tx, {
        eventType: ActivityEventType.INSPECTION_CHECKLIST_UPDATED,
        entityType: 'inspection_checklist',
        userId: user.id,
        newValue: { checks: input.items.length, active: input.items.filter((item) => item.active).length, limits: input.limits },
      });
    });
    return this.getChecklist(user);
  }

  // ───────────────────────── Helpers ─────────────────────────

  private async toInspectionDto(row: InspectionRow): Promise<TruckInspectionDto> {
    const sources = await this.prisma.workOrderJobSource.findMany({
      where: { OR: [{ inspectionItemId: { in: row.items.map((item) => item.id) } }, { tireReadingId: { in: row.tires.map((tire) => tire.id) } }] },
      orderBy: { createdAt: 'asc' },
      include: { workOrderJob: { select: { id: true, displayName: true, status: true, assignedMechanic: { select: { name: true } } } } },
    });
    const itemById = new Map(row.items.map((item) => [item.id, item]));
    const tireById = new Map(row.tires.map((tire) => [tire.id, tire]));
    const jobs = new Map<string, TruckInspectionDto['jobs'][number]>();
    for (const source of sources) {
      const job = source.workOrderJob;
      const entry = jobs.get(job.id) ?? { jobId: job.id, displayName: job.displayName, status: job.status, assignedMechanicName: job.assignedMechanic?.name ?? null, sources: [] };
      const item = source.inspectionItemId ? itemById.get(source.inspectionItemId) : undefined;
      const tire = source.tireReadingId ? tireById.get(source.tireReadingId) : undefined;
      entry.sources.push({
        kind: source.kind as WorkOrderJobSourceKind,
        label: item?.label ?? (tire ? `Tire ${tire.position}` : ''),
        note: source.note,
        addedLater: Boolean(item?.addedLaterAt),
      });
      jobs.set(job.id, entry);
    }
    const order = TIRE_POSITIONS as readonly string[];
    return {
      id: row.id,
      inspectedAt: row.inspectedAt.toISOString(),
      inspectedBy: { id: row.inspectedBy.id, name: row.inspectedBy.name, isMechanic: row.inspectedBy.role === 'mechanic' },
      workOrderId: row.workOrderId,
      notes: row.notes,
      items: row.items.map((item) => ({
        id: item.id,
        checklistItemId: item.checklistItemId,
        section: item.section as InspectionSection,
        label: item.label,
        result: item.result as InspectionItemResult,
        note: item.note,
        catalogJobName: item.catalogJob?.displayName ?? null,
        catalogJobId: item.catalogJobId,
        catalogCategoryName: item.catalogJob?.category.name ?? null,
        workflowStepKey: item.workflowStepKey,
        addedLater: item.addedLaterAt ? { at: item.addedLaterAt.toISOString(), byName: item.addedLaterBy?.name ?? null } : null,
      })),
      tires: [...row.tires].sort((a, b) => order.indexOf(a.position) - order.indexOf(b.position)).map(toTireDto),
      jobs: [...jobs.values()],
      issuesFound: sources.length > 0,
      workOrderOpen: Boolean(row.workOrder && (OPEN as string[]).includes(row.workOrder.status)),
    };
  }

  private async limits(client: Tx | PrismaService): Promise<InspectionTireLimits> {
    const row = await client.inspectionSettings.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULT_INSPECTION_TIRE_LIMITS;
    const { steerTargetPsi, driveTargetPsi, steerMinTread, driveMinTread, watchPct, fixPct } = row;
    return { steerTargetPsi, driveTargetPsi, steerMinTread, driveMinTread, watchPct, fixPct };
  }

  private activeChecklist(client: Tx | PrismaService): Promise<ChecklistRow[]> {
    return client.inspectionChecklistItem.findMany({
      where: { active: true },
      include: checklistInclude,
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  private activeAssessment(truckId: string) {
    return this.prisma.truckReadinessAssessment.findFirst({
      where: { truckId, status: { in: ['under_review', 'ready'] } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
  }

  private openWorkOrder(client: Tx | PrismaService, truckId: string) {
    return client.workOrder.findFirst({
      where: { truckId, status: { in: OPEN } },
      orderBy: { createdAt: 'asc' },
      include: {
        primaryCategory: { select: { name: true } },
        jobs: { include: { category: { select: { name: true } } } },
      },
    });
  }

  private async requireOpenWorkOrder(client: Tx | PrismaService, truckId: string) {
    const wo = await this.openWorkOrder(client, truckId);
    if (!wo) throw new ConflictException({ code: 'INSPECTION_NEEDS_WORK_ORDER', message: 'Open a Work Order for this Truck first.' });
    if (wo.primaryCategory.name === 'PM') throw new ConflictException({ code: 'INSPECTION_PM_WORK_ORDER', message: 'PM Work Orders are not inspected with the sheet.' });
    return wo;
  }

  /** Flat Repair (pressure) and Tires (tread), found by their catalog seed key (renaming them keeps it). */
  private async tireJobIds() {
    const rows = await this.prisma.catalogJob.findMany({
      where: { seedKey: { in: [jobSeedKey(TIRES_CATEGORY, 'Flat Repair'), jobSeedKey(TIRES_CATEGORY, 'Tires')] } },
      select: { id: true, seedKey: true },
    });
    const flatRepair = rows.find((row) => row.seedKey === jobSeedKey(TIRES_CATEGORY, 'Flat Repair'))?.id;
    const tires = rows.find((row) => row.seedKey === jobSeedKey(TIRES_CATEGORY, 'Tires'))?.id;
    if (!flatRepair || !tires) throw new ConflictException({ code: 'INSPECTION_TIRE_JOBS_MISSING', message: 'Flat Repair and Tires must be in the catalog.' });
    return { flatRepair, tires };
  }

  private async standardMechanics(tx: Tx, ids: string[]) {
    if (!ids.length) return new Map<string, { id: string; name: string }>();
    const rows = await tx.user.findMany({
      where: { id: { in: [...new Set(ids)] }, active: true, capabilities: { some: { capability: 'MECHANIC_STANDARD' } } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async replayed(idempotencyKey: string, operation: string, payloadHash: string, actorId: string) {
    return this.replayedInTx(this.prisma, idempotencyKey, operation, payloadHash, actorId);
  }

  private async replayedInTx(client: Tx | PrismaService, idempotencyKey: string, operation: string, payloadHash: string, actorId: string) {
    const row = await client.workOrderMutation.findUnique({ where: { idempotencyKey } });
    if (!row) return false;
    if (row.operation !== operation || row.payloadHash !== payloadHash || row.actorId !== actorId) {
      throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'This request was already used for something else.' });
    }
    return true;
  }
}

type OpenWorkOrder = NonNullable<Awaited<ReturnType<InspectionService['requireOpenWorkOrder']>>>;

function toChecklistItemDto(row: ChecklistRow): InspectionChecklistItemDto {
  return {
    id: row.id,
    section: row.section as InspectionSection,
    label: row.label,
    sortOrder: row.sortOrder,
    active: row.active,
    catalogJob: row.catalogJob
      ? { id: row.catalogJob.id, displayName: row.catalogJob.displayName, categoryName: row.catalogJob.category.name, active: row.catalogJob.status === 'active' }
      : null,
    workflowStepKey: row.workflowStepKey,
  };
}

function toTireDto(row: { position: string; psi: number; tread: number; targetPsi: number; minTread: number; status: string; readAt: Date }): TireReadingDto {
  return {
    position: row.position as TirePosition,
    psi: row.psi,
    tread: row.tread,
    targetPsi: row.targetPsi,
    minTread: row.minTread,
    status: row.status as TireReadingStatus,
    readAt: row.readAt.toISOString(),
  };
}

function badRequest(code: string, message: string) {
  return new BadRequestException({ code, message });
}

function assertUuid(value: string, message: string) {
  if (!UUID_PATTERN.test(value)) throw new BadRequestException(message);
}

function translatePlanError(error: unknown) {
  if (error instanceof InspectionPlanError) {
    return error.code === 'DETAILING_STEP_MISSING'
      ? new ConflictException({ code: 'INSPECTION_DETAILING_MISSING', message: 'This Work Order has no Detailing step. Add the missing steps first.' })
      : new ConflictException({ code: 'INSPECTION_CHECK_WITHOUT_JOB', message: 'A check points to no Job. Fix it in Setup → Inspection checklist.' });
  }
  return error;
}
