import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityEventType,
  WorkOrderJobSourceKind,
  qcFindingAddToJobSchema,
  qcFindingDismissSchema,
  type AdminOpenQcFindingDto,
  type AdminQcFindingDto,
} from '@ltl-shop/shared';
import type { Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const qcFindingInclude = {
  catalogJob: { select: { id: true, displayName: true, categoryId: true, category: { select: { name: true } } } },
  resolvedJob: { select: { id: true, displayName: true } },
} satisfies Prisma.QcFindingInclude;

type FindingRow = Prisma.QcFindingGetPayload<{ include: typeof qcFindingInclude }>;

export function toQcFindingDto(row: FindingRow): AdminQcFindingDto {
  return {
    id: row.id,
    workOrderId: row.workOrderId,
    kind: row.kind,
    text: row.text,
    catalogJob: row.catalogJob
      ? { id: row.catalogJob.id, displayName: row.catalogJob.displayName, categoryId: row.catalogJob.categoryId, categoryName: row.catalogJob.category.name }
      : null,
    createdAt: row.createdAt.toISOString(),
    resolution: row.resolution,
    resolvedJob: row.resolvedJob,
    dismissReason: row.dismissReason,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

/** The Dashboard's list: findings not handled yet, on Work Orders of the last 30 days. */
export async function openQcFindingsForDashboard(prisma: Pick<PrismaService, 'qcFinding'>): Promise<AdminOpenQcFindingDto[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.qcFinding.findMany({
    where: { resolvedAt: null, createdAt: { gte: since }, workOrder: { status: { not: 'cancelled' } } },
    include: { workOrder: { select: { id: true, displayId: true, truck: { select: { id: true, truckNumber: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    workOrderId: row.workOrder.id,
    workOrderDisplayId: row.workOrder.displayId,
    truckId: row.workOrder.truck.id,
    truckNumber: row.workOrder.truck.truckNumber,
  }));
}

/**
 * D46 / SQ-3 (LTR-232): what Safety found at the Quality Check, handled by the Manager. A finding becomes a Job (Add
 * work, `qcFindingIds`), is added to a Job already on the Work Order, or is set aside with a reason. The Job keeps it
 * as a source (`work_order_job_sources`, kind `qc_finding`), so the mechanic reads it in that Job. Never who wrote it.
 */
@Injectable()
export class QcFindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async openFor(workOrderId: string): Promise<AdminQcFindingDto[]> {
    const rows = await this.prisma.qcFinding.findMany({ where: { workOrderId, resolvedAt: null }, include: qcFindingInclude, orderBy: { createdAt: 'asc' } });
    return rows.map(toQcFindingDto);
  }

  openForDashboard(): Promise<AdminOpenQcFindingDto[]> {
    return openQcFindingsForDashboard(this.prisma);
  }

  async addToJob(user: AuthUser, workOrderId: string, findingId: string, raw: unknown) {
    const { jobId } = this.parse(qcFindingAddToJobSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      const finding = await this.openFinding(tx, workOrderId, findingId);
      const job = await tx.workOrderJob.findFirst({ where: { id: jobId, workOrderId, status: 'to_do' }, select: { id: true, displayName: true } });
      if (!job) throw new BadRequestException({ code: 'QC_FINDING_JOB_NOT_OPEN', message: 'Pick a Job of this Work Order that is still to do.' });
      await this.link(tx, user, finding, job, 'added_to_job');
      return { id: finding.id };
    });
  }

  async dismiss(user: AuthUser, workOrderId: string, findingId: string, raw: unknown) {
    const { reason } = this.parse(qcFindingDismissSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      const finding = await this.openFinding(tx, workOrderId, findingId);
      await tx.qcFinding.update({ where: { id: finding.id }, data: { resolution: 'dismissed', dismissReason: reason, resolvedById: user.id, resolvedAt: new Date() } });
      await this.activity.log(tx, {
        workOrderId,
        eventType: ActivityEventType.MANAGER_CORRECTION,
        entityType: 'qc_finding',
        entityId: finding.id,
        userId: user.id,
        newValue: { action: 'qc_finding_dismissed', text: finding.text, reason },
        relevantValue: { action: 'qc_finding_dismissed', text: finding.text, reason },
      });
      return { id: finding.id };
    });
  }

  /** Add work: each new Job takes the findings its draft carried (matched by catalog Job or name, like D42). */
  async linkToNewJobs(
    user: AuthUser,
    workOrderId: string,
    drafts: Array<{ catalogJobId?: string | null; displayName: string; qcFindingIds?: string[] }>,
    before: Set<string>,
  ) {
    if (!drafts.some((draft) => draft.qcFindingIds?.length)) return;
    const created = await this.prisma.workOrderJob.findMany({
      where: { workOrderId, id: { notIn: [...before] }, status: { not: 'cancelled' } },
      select: { id: true, catalogJobId: true, displayName: true },
      orderBy: { addedAt: 'asc' },
    });
    const used = new Set<string>();
    await this.prisma.$transaction(async (tx) => {
      for (const draft of drafts) {
        if (!draft.qcFindingIds?.length) continue;
        const job = created.find((row) => !used.has(row.id) && (draft.catalogJobId ? row.catalogJobId === draft.catalogJobId : !row.catalogJobId && row.displayName === draft.displayName));
        if (!job) continue;
        used.add(job.id);
        const findings = await tx.qcFinding.findMany({ where: { id: { in: draft.qcFindingIds }, workOrderId, resolvedAt: null } });
        for (const finding of findings) await this.link(tx, user, finding, job, 'job_added');
      }
    });
  }

  /** Findings sent with Add work must be open findings of this truck's Work Order. */
  async assertLinkable(workOrderId: string | null, ids: string[]) {
    if (!ids.length) return;
    const found = workOrderId ? await this.prisma.qcFinding.count({ where: { id: { in: ids }, workOrderId, resolvedAt: null } }) : 0;
    if (found !== new Set(ids).size) throw new ConflictException({ code: 'QC_FINDING_NOT_OPEN', message: 'A Safety finding was already handled. Reload and try again.' });
  }

  private async link(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    finding: { id: string; text: string; workOrderId: string },
    job: { id: string; displayName: string },
    resolution: 'job_added' | 'added_to_job',
  ) {
    await tx.workOrderJobSource.createMany({
      data: [{ workOrderJobId: job.id, kind: WorkOrderJobSourceKind.QC_FINDING, qcFindingId: finding.id, note: finding.text.slice(0, 1000), createdById: user.id }],
      skipDuplicates: true,
    });
    await tx.qcFinding.update({ where: { id: finding.id }, data: { resolution, resolvedJobId: job.id, resolvedById: user.id, resolvedAt: new Date() } });
    await this.activity.log(tx, {
      workOrderId: finding.workOrderId,
      eventType: ActivityEventType.MANAGER_CORRECTION,
      entityType: 'qc_finding',
      entityId: finding.id,
      userId: user.id,
      newValue: { action: resolution === 'job_added' ? 'qc_finding_job_added' : 'qc_finding_added_to_job', text: finding.text, jobId: job.id, jobName: job.displayName },
      relevantValue: { action: resolution === 'job_added' ? 'qc_finding_job_added' : 'qc_finding_added_to_job', text: finding.text, job: job.displayName },
    });
  }

  private async openFinding(tx: Prisma.TransactionClient, workOrderId: string, findingId: string) {
    if (!UUID.test(workOrderId) || !UUID.test(findingId)) throw new BadRequestException('Invalid id');
    const finding = await tx.qcFinding.findFirst({ where: { id: findingId, workOrderId } });
    if (!finding) throw new NotFoundException('Finding not found');
    if (finding.resolvedAt) throw new ConflictException({ code: 'QC_FINDING_HANDLED', message: 'This finding was already handled.' });
    return finding;
  }

  private parse<T>(schema: { safeParse(raw: unknown): { success: true; data: T } | { success: false; error: { flatten(): unknown } } }, raw: unknown): T {
    const parsed = schema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return parsed.data;
  }
}
