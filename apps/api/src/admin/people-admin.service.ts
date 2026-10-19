import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityEventType, OPEN_WORK_ORDER_STATUSES, ShopWorkflowStepKey, adminSendJobsToQueueSchema } from '@ltl-shop/shared';
import type { WorkOrderStatus } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { AuthUser } from '../auth/auth.guard';
import { invalidateAuthUserCache } from '../auth/auth-user-cache';
import { SupabaseAdminClient } from '../auth/supabase-admin';
import { lockTruckMutation } from '../common/truck-mutation-lock';
import { PrismaService } from '../prisma/prisma.service';
import { personHistoryCount } from './admin.service';
import { SystemAdminWritesService, assertCanManagePerson, assertNotLastSystemAdmin } from './system-admin-writes.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * LTR-199 / D31: the Shop's people beyond create, rename, type and deactivate (SystemAdminWritesService).
 * - **Remove from Shop**: out of every list and team for good; their name stays in the history. Refused with
 *   `MECHANIC_HAS_OPEN_WORK` while they have Jobs to do or time running, like deactivating.
 * - **Delete**: only for someone who never did anything (`PERSON_HAS_HISTORY` otherwise).
 * - **Send to team queue** (D28): their Jobs that came from a team queue go back there.
 */
@Injectable()
export class PeopleAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writes: SystemAdminWritesService,
    private readonly activity: ActivityLogService,
    private readonly supabaseAdmin: SupabaseAdminClient,
  ) {}

  async remove(actor: AuthUser, id: string) {
    const person = await this.person(id);
    // D48: Managers and System Admins only by a System Admin; never yourself; never the last System Admin.
    assertCanManagePerson(actor, person, true);
    if (person.removedAt) return { removed: true };
    await this.prisma.$transaction(async (tx) => {
      await assertNotLastSystemAdmin(tx, person);
      const openWork = await this.writes.openWorkOf(tx, id);
      if (openWork) throw new ConflictException(openWork);
      await tx.shopWorkflowStepMember.deleteMany({ where: { userId: id } });
      await tx.user.update({ where: { id }, data: { active: false, removedAt: new Date(), removedById: actor.id } });
    });
    invalidateAuthUserCache();
    return { removed: true };
  }

  async delete(actor: AuthUser, id: string) {
    const person = await this.person(id);
    assertCanManagePerson(actor, person, true);
    await assertNotLastSystemAdmin(this.prisma, person);
    if (await personHistoryCount(this.prisma, id)) {
      throw new ConflictException({
        code: 'PERSON_HAS_HISTORY',
        message: 'This person has history in the Shop, so they cannot be deleted. Remove them from the Shop instead.',
      });
    }
    if (person.supabaseAuthId && this.supabaseAdmin.isConfigured()) {
      await this.supabaseAdmin.deleteUser(person.supabaseAuthId);
    }
    await this.prisma.user.delete({ where: { id } });
    invalidateAuthUserCache();
    return { deleted: true };
  }

  /** D28: the person's pending Jobs born in a team queue go back to it (not while their clock runs on that truck). */
  async sendJobsToQueue(actor: AuthUser, id: string, raw: unknown) {
    assertCanManagePerson(actor, await this.person(id));
    const parsed = adminSendJobsToQueueSchema.safeParse(raw ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const jobs = await this.prisma.workOrderJob.findMany({
      where: {
        assignedMechanicId: id,
        status: 'to_do',
        workflowStepKey: { not: null, notIn: [ShopWorkflowStepKey.QUALITY_CHECK] },
        workOrder: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
        ...(parsed.data.jobIds ? { id: { in: parsed.data.jobIds } } : {}),
      },
      select: { id: true, displayName: true, workflowStepKey: true, workOrderId: true, startedAt: true, workOrder: { select: { truckId: true } } },
    });
    let sent = 0;
    let skipped = 0;
    for (const job of jobs) {
      const done = await this.prisma.$transaction(async (tx) => {
        await lockTruckMutation(tx, job.workOrder.truckId);
        const running = await tx.workSession.findFirst({ where: { workOrderId: job.workOrderId, userId: id, endedAt: null }, select: { id: true } });
        if (running || job.startedAt) return false;
        const released = await tx.workOrderJob.updateMany({ where: { id: job.id, assignedMechanicId: id, status: 'to_do' }, data: { assignedMechanicId: null } });
        if (released.count !== 1) return false;
        const stillTheirs = await tx.workOrderJob.count({ where: { workOrderId: job.workOrderId, assignedMechanicId: id, status: { not: 'cancelled' } } });
        if (!stillTheirs) {
          await tx.mechanicAssignment.updateMany({ where: { workOrderId: job.workOrderId, mechanicId: id, removedAt: null }, data: { removedAt: new Date() } });
        }
        await tx.workOrder.update({ where: { id: job.workOrderId }, data: { version: { increment: 1 } } });
        await this.activity.log(tx, {
          workOrderId: job.workOrderId,
          eventType: ActivityEventType.MECHANIC_REMOVED,
          entityType: 'work_order_job',
          entityId: job.id,
          userId: actor.id,
          previousValue: { jobId: job.id, assignedMechanicId: id, displayName: job.displayName, stepKey: job.workflowStepKey },
          relevantValue: { action: 'job_sent_to_team_queue', displayName: job.displayName },
        });
        return true;
      });
      if (done) sent += 1;
      else skipped += 1;
    }
    return { sent, skipped };
  }

  private async person(id: string) {
    if (!UUID.test(id)) throw new BadRequestException('Invalid Mechanic id');
    // D48: People holds Managers and System Admins too; who may act on them is `assertCanManagePerson`.
    const person = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, active: true, removedAt: true, supabaseAuthId: true } });
    if (!person) throw new NotFoundException('Mechanic not found');
    return person;
  }
}
