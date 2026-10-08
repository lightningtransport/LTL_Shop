import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  AppCapability,
  UserRole,
  updateShopWorkflowStepsSchema,
  type ShopWorkflowStepDto,
} from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { hasCapability } from '../auth/capabilities';
import { PrismaService } from '../prisma/prisma.service';
import { usableDefaultOwner, workflowStepOwnerCapability } from '../work-orders/mandatory-jobs';

const stepSelect = {
  stepKey: true,
  sortOrder: true,
  active: true,
  updatedAt: true,
  catalogJob: { select: { id: true, displayName: true, status: true, category: { select: { name: true, status: true } } } },
  defaultMechanic: { select: { id: true, name: true, active: true, capabilities: { select: { capability: true } } } },
  updatedBy: { select: { id: true, name: true } },
} as const;

/**
 * LTR-157 / D15, D16: Admin → Setup → Shop workflow. One row per mandatory step
 * (from LTR-156) with its default owner. New Work Orders read it at creation;
 * open Work Orders are not changed.
 */
@Injectable()
export class ShopWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ShopWorkflowStepDto[]> {
    const rows = await this.prisma.shopWorkflowStep.findMany({ orderBy: { sortOrder: 'asc' }, select: stepSelect });
    return rows.map((row) => {
      const capability = workflowStepOwnerCapability(row.stepKey);
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
        defaultMechanic: row.defaultMechanic
          ? {
              id: row.defaultMechanic.id,
              name: row.defaultMechanic.name,
              active: row.defaultMechanic.active,
              // SW1: an owner who left or changed type stays visible, marked, instead of blocking every save.
              eligible: usableDefaultOwner(row.stepKey, row.defaultMechanic) !== null,
            }
          : null,
        allowsDefaultMechanic: capability !== null,
        requiredCapability: capability,
        updatedAt: row.updatedAt.toISOString(),
        updatedBy: row.updatedBy,
      };
    });
  }

  /** The Manager (work_orders.manage) or the System Admin changes default owners. */
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
      (await this.prisma.shopWorkflowStep.findMany({ select: { stepKey: true, defaultMechanicId: true } }))
        .map((row) => [row.stepKey, row.defaultMechanicId]),
    );
    const ownerIds = steps.map((step) => step.defaultMechanicId).filter((id): id is string => Boolean(id));
    const owners = new Map(
      (await this.prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, active: true, capabilities: { select: { capability: true } } },
      })).map((owner) => [owner.id, owner]),
    );
    for (const step of steps) {
      if (!current.has(step.stepKey)) {
        throw new BadRequestException({ code: 'UNKNOWN_STEP', message: `Step ${step.stepKey} is not configured.` });
      }
      if (!step.defaultMechanicId) continue;
      // SW1: an owner who is not changing is not re-checked, so one owner who left does not block other steps.
      if (current.get(step.stepKey) === step.defaultMechanicId) continue;
      const capability = workflowStepOwnerCapability(step.stepKey);
      if (!capability) {
        // D15: Quality Check has no owner; the Manager completes it from the Truck.
        throw new BadRequestException({ code: 'STEP_HAS_NO_OWNER', message: 'Quality Check has no default owner.' });
      }
      const owner = owners.get(step.defaultMechanicId);
      if (!owner || !usableDefaultOwner(step.stepKey, owner)) {
        throw new BadRequestException({
          code: 'OWNER_NOT_ELIGIBLE',
          message: `The default owner of ${step.stepKey} must be an active mechanic with ${capability}.`,
        });
      }
    }
    await this.prisma.$transaction(steps.map((step) => this.prisma.shopWorkflowStep.update({
      where: { stepKey: step.stepKey },
      data: { defaultMechanicId: step.defaultMechanicId, updatedById: user.id },
    })));
    return this.list();
  }
}
