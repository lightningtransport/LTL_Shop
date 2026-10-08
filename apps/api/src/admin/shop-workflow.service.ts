import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  AppCapability,
  OPEN_WORK_ORDER_STATUSES,
  ShopWorkflowStepKey,
  UserRole,
  updateShopWorkflowStepsSchema,
  type ShopWorkflowStepDto,
} from '@ltl-shop/shared';
import type { WorkOrderStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.guard';
import { hasCapability } from '../auth/capabilities';
import { PrismaService } from '../prisma/prisma.service';
import { eligibleTeamMember, teamAssignment, workflowStepMemberCapability, workflowStepOwnerCapability } from '../work-orders/mandatory-jobs';

const memberUserSelect = { id: true, name: true, active: true, role: true, capabilities: { select: { capability: true } } } as const;

const stepSelect = {
  id: true,
  stepKey: true,
  sortOrder: true,
  active: true,
  updatedAt: true,
  catalogJob: { select: { id: true, displayName: true, status: true, category: { select: { name: true, status: true } } } },
  members: { select: { user: { select: memberUserSelect } }, orderBy: { addedAt: 'asc' as const } },
  updatedBy: { select: { id: true, name: true } },
} as const;

/**
 * LTR-157 / D15, D16: Admin → Setup → Shop workflow. One row per mandatory step.
 * LTR-197 / D28: each step has a team — one eligible member gets new Jobs directly, two or more share a queue.
 * New Work Orders read it at creation; open Work Orders are not changed.
 */
@Injectable()
export class ShopWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ShopWorkflowStepDto[]> {
    const rows = await this.prisma.shopWorkflowStep.findMany({ orderBy: { sortOrder: 'asc' }, select: stepSelect });
    const memberIds = [...new Set(rows.flatMap((row) => row.members.map((member) => member.user.id)))];
    const pending = memberIds.length
      ? await this.prisma.workOrderJob.groupBy({
        by: ['assignedMechanicId'],
        where: {
          assignedMechanicId: { in: memberIds },
          status: 'to_do',
          workOrder: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
        },
        _count: { _all: true },
      })
      : [];
    const pendingBy = new Map(pending.map((row) => [row.assignedMechanicId, row._count._all]));
    return rows.map((row) => {
      const users = row.members.map((member) => member.user);
      const members = users.map((member) => ({
        id: member.id,
        name: member.name,
        active: member.active,
        eligible: eligibleTeamMember(row.stepKey, member),
        pendingJobCount: pendingBy.get(member.id) ?? 0,
      }));
      const only = members.length === 1 ? members[0] : null;
      return {
        stepKey: row.stepKey,
        sortOrder: row.sortOrder,
        active: row.active,
        catalogJob: {
          id: row.catalogJob.id,
          displayName: row.catalogJob.displayName,
          categoryName: row.catalogJob.category.name,
          // SW2: an inactive Job or category means new Work Orders skip this step (`resolveMandatoryJobs`).
          active: row.catalogJob.status === 'active' && row.catalogJob.category.status === 'active',
        },
        defaultMechanic: only ? { id: only.id, name: only.name, active: only.active, eligible: only.eligible } : null,
        members,
        assignment: teamAssignment(row.stepKey, users).mode,
        allowsDefaultMechanic: workflowStepOwnerCapability(row.stepKey) !== null,
        requiredCapability: workflowStepMemberCapability(row.stepKey),
        updatedAt: row.updatedAt.toISOString(),
        updatedBy: row.updatedBy,
      };
    });
  }

  /** The Manager (work_orders.manage) or the System Admin changes each step's team. */
  async update(user: AuthUser, raw: unknown): Promise<ShopWorkflowStepDto[]> {
    if (!hasCapability(user, AppCapability.WORK_ORDERS_MANAGE) && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only a Shop Manager or a System Admin can change the shop workflow.');
    }
    const parsed = updateShopWorkflowStepsSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { steps } = parsed.data;
    if (new Set(steps.map((step) => step.stepKey)).size !== steps.length) {
      throw new BadRequestException({ code: 'DUPLICATE_STEP', message: 'Each step can be listed once.' });
    }
    const current = new Map(
      (await this.prisma.shopWorkflowStep.findMany({ select: { id: true, stepKey: true, members: { select: { userId: true } } } }))
        .map((row) => [row.stepKey, { id: row.id, memberIds: new Set(row.members.map((member) => member.userId)) }]),
    );
    const teams = steps.flatMap((step) => {
      if (step.stepKey === ShopWorkflowStepKey.QUALITY_CHECK && step.memberIds === undefined) {
        // D15 (pre-team shape): Quality Check takes no single owner; its Job waits in Safety's queue. A pre-team
        // `null` leaves Safety's team as it is.
        if (step.defaultMechanicId) {
          throw new BadRequestException({ code: 'STEP_HAS_NO_OWNER', message: 'Quality Check has no default owner.' });
        }
        return [];
      }
      const memberIds = [...new Set(step.memberIds ?? (step.defaultMechanicId ? [step.defaultMechanicId] : []))];
      return [{ stepKey: step.stepKey, memberIds }];
    });
    const users = new Map(
      (await this.prisma.user.findMany({
        where: { id: { in: [...new Set(teams.flatMap((team) => team.memberIds))] } },
        select: memberUserSelect,
      })).map((member) => [member.id, member]),
    );
    for (const team of teams) {
      const existing = current.get(team.stepKey);
      if (!existing) {
        throw new BadRequestException({ code: 'UNKNOWN_STEP', message: `Step ${team.stepKey} is not configured.` });
      }
      for (const memberId of team.memberIds) {
        // SW1 / D-SET2: someone already on the team who can no longer do the step is kept (marked), not re-checked.
        if (existing.memberIds.has(memberId)) continue;
        const member = users.get(memberId);
        if (!member || !eligibleTeamMember(team.stepKey, member)) {
          throw new BadRequestException({
            code: 'OWNER_NOT_ELIGIBLE',
            message: `Everyone added to ${team.stepKey} must be active with ${workflowStepMemberCapability(team.stepKey)}.`,
            stepKey: team.stepKey,
            userId: memberId,
          });
        }
      }
    }
    await this.prisma.$transaction(async (tx) => {
      for (const team of teams) {
        const step = current.get(team.stepKey)!;
        await tx.shopWorkflowStepMember.deleteMany({ where: { stepId: step.id, userId: { notIn: team.memberIds } } });
        const added = team.memberIds.filter((memberId) => !step.memberIds.has(memberId));
        if (added.length) {
          await tx.shopWorkflowStepMember.createMany({
            data: added.map((memberId) => ({ stepId: step.id, userId: memberId, addedById: user.id })),
            skipDuplicates: true,
          });
        }
        await tx.shopWorkflowStep.update({
          where: { id: step.id },
          // `default_mechanic_id` mirrors a team of one so an older build still reads a sensible owner.
          data: { defaultMechanicId: team.memberIds.length === 1 ? team.memberIds[0] : null, updatedById: user.id },
        });
      }
    });
    return this.list();
  }
}
