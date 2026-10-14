import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, WorkOrderJobSourceKind, type TruckFault } from '@prisma/client';
import {
  OPEN_WORK_ORDER_STATUSES,
  dismissTruckFaultSchema,
  faultCodeKey,
  linkTruckFaultsSchema,
  type TruckFaultRecommendationDto,
  type TruckFaultRecommendationsDto,
  type WorkOrderStatus,
} from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { SEVERITY_RANK } from '../integrations/samsara/samsara-faults';
import { PrismaService } from '../prisma/prisma.service';
import { dashLamps } from '../trucks/trucks.service';
import { faultWithJobs, openJobFor, toFaultDto, type FaultWithJobs } from './truck-faults.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


/**
 * D42 / S-6 (OPEN_ISSUES §1x): Samsara faults as recommended Jobs in Add work.
 *
 * Recommended: active, not dismissed, not taken care of by an open Job. Codes that lit check engine always; when the
 * truck's STOP or warning light is on, its other active codes too (J1939 does not say which code lit it), never pending
 * ones. A fault whose Job was completed but that Samsara still reports is recommended again ("still after WO-x").
 */
@Injectable()
export class SamsaraFaultJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async recommendations(truckId: string): Promise<TruckFaultRecommendationsDto> {
    this.assertUuid(truckId, 'Invalid Truck id');
    const truck = await this.prisma.truck.findUnique({
      where: { id: truckId },
      select: {
        samsaraStopLamp: true, samsaraWarningLamp: true, samsaraProtectLamp: true, samsaraEmissionsLamp: true, samsaraLampsAt: true,
        faults: { where: { clearedAt: null, dismissedAt: null }, include: faultWithJobs },
        workOrders: {
          where: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] as never } },
          select: { jobs: { where: { status: JobStatus.to_do }, select: { id: true, displayName: true, catalogJobId: true } } },
          take: 1,
        },
      },
    });
    if (!truck) throw new NotFoundException('Truck not found');

    const lamps = dashLamps(truck);
    const lightReason = lamps?.stop ? 'stop_light' : lamps?.warning || lamps?.protect ? 'warning_light' : null;
    const openJobs = truck.workOrders[0]?.jobs ?? [];

    const candidates = truck.faults
      .filter((fault) => !openJobFor(fault))
      .map((fault) => {
        const reason = fault.severity === 'check_engine' ? 'check_engine' : lightReason && fault.severity !== 'pending' ? lightReason : null;
        return reason ? { fault, reason } : null;
      })
      .filter((item): item is { fault: FaultWithJobs; reason: TruckFaultRecommendationDto['reason'] } => Boolean(item));

    const codeKeys = [...new Set(candidates.map(({ fault }) => faultCodeKey(fault)))];
    const learned = codeKeys.length
      ? await this.prisma.samsaraFaultCodeJob.findMany({
          where: { codeKey: { in: codeKeys }, catalogJob: { status: 'active', category: { status: 'active' } } },
          select: { codeKey: true, catalogJob: { select: { id: true, displayName: true, categoryId: true, category: { select: { name: true } } } } },
        })
      : [];
    const byCode = new Map(learned.map((row) => [row.codeKey, row.catalogJob]));

    const items: TruckFaultRecommendationDto[] = candidates.map(({ fault, reason }) => {
      const job = byCode.get(faultCodeKey(fault)) ?? null;
      const existing = job ? openJobs.find((open) => open.catalogJobId === job.id) ?? null : null;
      const completed = fault.jobSources.map((source) => source.workOrderJob).find((linked) => linked.status === JobStatus.completed);
      return {
        fault: toFaultDto(fault),
        reason,
        suggestedJob: job ? { catalogJobId: job.id, displayName: job.displayName, categoryId: job.categoryId, categoryName: job.category.name } : null,
        existingJob: existing ? { id: existing.id, displayName: existing.displayName } : null,
        stillAfter: completed ? { workOrderId: completed.workOrder.id, displayId: completed.workOrder.displayId } : null,
      };
    });
    const rank = { stop_light: 0, warning_light: 1, check_engine: 2 } as const;
    items.sort((a, b) => rank[a.reason] - rank[b.reason] || SEVERITY_RANK[a.fault.severity] - SEVERITY_RANK[b.fault.severity]);
    return { items };
  }

  /** The faults must be this truck's, active, and not already taken care of by an open Job. */
  async assertLinkable(truckId: string, faultIds: string[]): Promise<FaultWithJobs[]> {
    const unique = [...new Set(faultIds)];
    const faults = await this.prisma.truckFault.findMany({ where: { id: { in: unique }, truckId }, include: faultWithJobs });
    if (faults.length !== unique.length) throw new BadRequestException({ code: 'FAULT_NOT_FOUND', message: 'A fault does not belong to this truck.' });
    const closed = faults.find((fault) => fault.clearedAt);
    if (closed) throw new ConflictException({ code: 'FAULT_CLEARED', message: `${closed.code} is no longer reported by Samsara.` });
    const covered = faults.find((fault) => openJobFor(fault));
    if (covered) {
      const job = openJobFor(covered)!;
      throw new ConflictException({ code: 'FAULT_ALREADY_IN_WORK', message: `${covered.code} is already on ${job.workOrder.displayId} (${job.displayName}).` });
    }
    return faults;
  }

  /**
   * Ties faults to a Job (new from Add work, or already on the plan) and learns the Job for each code when it is a
   * catalog Job. The note on the source is what the mechanic reads ("SPN 3251 · FMI 0 — DPF differential pressure").
   */
  async linkToJob(user: AuthUser, workOrderJobId: string, faults: Array<Pick<TruckFault, 'id' | 'protocol' | 'code' | 'description'>>) {
    const job = await this.prisma.workOrderJob.findUnique({ where: { id: workOrderJobId }, select: { id: true, catalogJobId: true } });
    if (!job) throw new NotFoundException('Job not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.workOrderJobSource.createMany({
        data: faults.map((fault) => ({
          workOrderJobId,
          kind: WorkOrderJobSourceKind.samsara_fault,
          truckFaultId: fault.id,
          note: `${fault.code} — ${fault.description}`.slice(0, 1000),
          createdById: user.id,
        })),
        skipDuplicates: true,
      });
      if (job.catalogJobId) {
        for (const codeKey of new Set(faults.map((fault) => faultCodeKey(fault)))) {
          await tx.samsaraFaultCodeJob.upsert({
            where: { codeKey },
            create: { codeKey, catalogJobId: job.catalogJobId, updatedById: user.id },
            update: { catalogJobId: job.catalogJobId, updatedById: user.id },
          });
        }
      }
    });
  }

  /** "Add to this Job": tie faults to a Job already on the truck's open Work Order. */
  async link(user: AuthUser, truckId: string, raw: unknown) {
    this.assertUuid(truckId, 'Invalid Truck id');
    const parsed = linkTruckFaultsSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const job = await this.prisma.workOrderJob.findUnique({
      where: { id: parsed.data.workOrderJobId },
      select: { status: true, workOrder: { select: { truckId: true, status: true } } },
    });
    if (!job || job.workOrder.truckId !== truckId) throw new NotFoundException('Job not found on this truck');
    if (job.status !== JobStatus.to_do || !(OPEN_WORK_ORDER_STATUSES as string[]).includes(job.workOrder.status)) {
      throw new ConflictException({ code: 'JOB_NOT_OPEN', message: 'That Job is no longer open.' });
    }
    const faults = await this.assertLinkable(truckId, parsed.data.faultIds);
    await this.linkToJob(user, parsed.data.workOrderJobId, faults);
    return this.recommendations(truckId);
  }

  /** "Not now": kept out of recommendations until this row clears and the code comes back as a new one. */
  async dismiss(user: AuthUser, truckId: string, faultId: string, raw: unknown) {
    this.assertUuid(truckId, 'Invalid Truck id');
    this.assertUuid(faultId, 'Invalid fault id');
    const parsed = dismissTruckFaultSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const updated = await this.prisma.truckFault.updateMany({
      where: { id: faultId, truckId, clearedAt: null },
      data: { dismissedAt: new Date(), dismissedById: user.id, dismissReason: parsed.data.reason },
    });
    if (!updated.count) throw new NotFoundException('Active fault not found on this truck');
    return this.recommendations(truckId);
  }

  private assertUuid(value: string, message: string) {
    if (!UUID.test(value)) throw new BadRequestException(message);
  }
}
