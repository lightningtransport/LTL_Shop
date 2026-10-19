import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CatalogStatus,
  MechanicMode,
  OPEN_WORK_ORDER_STATUSES,
  UserRole,
  adminCreateCatalogJobSchema,
  adminCreateMechanicSchema,
  adminUpdateCatalogJobSchema,
  adminUpdateMechanicSchema,
  type AdminCatalogJobWriteDto,
  type AdminMechanicCreatedDto,
  type AdminMechanicOpenWorkDto,
  type AdminMechanicPasswordResetDto,
  type AdminMechanicPendingJobDto,
  type UserDto,
} from '@ltl-shop/shared';
import { AppCapability, Prisma, type UserRole as PrismaUserRole, type WorkOrderStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.guard';
import { invalidateAuthUserCache } from '../auth/auth-user-cache';
import { toSharedCapability } from '../auth/capabilities';
import { SupabaseAdminClient, SupabaseAdminError } from '../auth/supabase-admin';
import { generateTemporaryPassword } from '../auth/temporary-password';
import { normalizeAlias } from '../job-catalog/job-catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { LaborClockService } from '../work-orders/labor-clock.service';
import { workflowStepMemberCapability } from '../work-orders/mandatory-jobs';

/** D22: the three roster types. Exactly one per person with `role: mechanic`. */
export const MECHANIC_CAPS = [
  AppCapability.MECHANIC_STANDARD,
  AppCapability.MECHANIC_PM,
  AppCapability.QUALITY_CHECK_PERFORM,
] as const;

/**
 * LTR-253 / D48: the package of a Shop Manager and of a System Admin (the one the working accounts hold). The type
 * comes from the role; both get the same three permissions.
 */
export const STAFF_CAPS = [
  AppCapability.ADMIN_ACCESS,
  AppCapability.YARD_OPERATIONS_MANAGE,
  AppCapability.WORK_ORDERS_MANAGE,
] as const;

/** D48: a Shop Manager or a System Admin (not shop floor staff). */
export function isStaffRole(role: string): role is 'manager' | 'admin' {
  return role === 'manager' || role === 'admin';
}

/**
 * D48: only a System Admin changes a Manager or a System Admin; a Manager handles Standard, PM and Safety only.
 * `retire` (deactivate, remove, delete) also refuses the actor's own row.
 */
export function assertCanManagePerson(actor: Pick<AuthUser, 'id' | 'role'>, target: { id: string; role: string }, retire = false) {
  if (isStaffRole(target.role) && actor.role !== 'admin') {
    throw new ForbiddenException({ code: 'STAFF_ADMIN_ONLY', message: 'Only a System Admin can change a Manager or a System Admin.' });
  }
  if (retire && actor.id === target.id) {
    throw new ConflictException({ code: 'PERSON_IS_SELF', message: 'You cannot deactivate, remove or delete yourself.' });
  }
}

/** D48: the Shop never stays without an active System Admin. */
export async function assertNotLastSystemAdmin(tx: Pick<Prisma.TransactionClient, 'user'>, target: { id: string; role: string; active: boolean }) {
  if (target.role !== 'admin' || !target.active) return;
  const others = await tx.user.count({ where: { role: 'admin', active: true, removedAt: null, id: { not: target.id } } });
  if (!others) {
    throw new ConflictException({ code: 'LAST_SYSTEM_ADMIN', message: 'The Shop needs at least one active System Admin.' });
  }
}

const mechanicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  removedAt: true,
  supabaseAuthId: true,
  capabilities: { select: { capability: true } },
} as const;

type MechanicRow = Prisma.UserGetPayload<{ select: typeof mechanicSelect }>;
type CatalogClient = Prisma.TransactionClient | PrismaService;

/**
 * Roster (D22 / LTR-187) and catalog (LTR-77, D25) writes.
 *
 * Roster and catalog: `ManagerWritesGuard` (Shop Manager or System Admin) is the authorization gate. Creating
 * a person also creates the Supabase Auth account with a temporary password that is returned once
 * and never stored or logged; deactivation is refused while the person has Jobs to do or labor
 * time running (`MECHANIC_HAS_OPEN_WORK`). Nothing is deleted.
 *
 * Catalog (D25): a Job name already in the category (trimmed, case-insensitive) is refused with
 * `CATALOG_JOB_EXISTS` and the existing `jobId`. These methods do not re-check capabilities and
 * do not invent new ones. Audit uses columns that already exist:
 * `user_capabilities.granted_by_id` / `granted_at`, and `catalog_jobs.created_by_id`.
 */
@Injectable()
export class SystemAdminWritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminClient,
    private readonly clock?: LaborClockService,
  ) {}

  async createMechanic(actor: AuthUser, raw: unknown): Promise<AdminMechanicCreatedDto> {
    const parsed = adminCreateMechanicSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { email, name, mode, role } = parsed.data;
    // D48: only a System Admin adds a Manager or a System Admin.
    if (isStaffRole(role) && actor.role !== 'admin') {
      throw new ForbiddenException({ code: 'STAFF_ADMIN_ONLY', message: 'Only a System Admin can add a Manager or a System Admin.' });
    }
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, role: true },
    });
    if (existing) throw this.emailConflict(existing);

    // D22: the access account first, so a failure there creates nothing in the Shop.
    const account = await this.createAuthAccount(email, name);

    try {
      const created = await this.prisma.user.create({
        data: {
          email,
          name,
          role,
          active: true,
          supabaseAuthId: account?.authId ?? null,
          capabilities: {
            // D48: a Manager or System Admin gets its whole package, so nobody adds permissions by hand.
            create: (isStaffRole(role) ? [...STAFF_CAPS] : [mechanicCapability(mode as MechanicMode)])
              .map((capability) => ({ capability, grantedById: actor.id })),
          },
        },
        select: mechanicSelect,
      });
      invalidateAuthUserCache();
      return { ...toUserDto(created), temporaryPassword: account?.temporaryPassword ?? null };
    } catch (error) {
      // The Shop row failed: take the auth account back so a retry starts clean.
      if (account) await this.supabaseAdmin.deleteUser(account.authId).catch(() => undefined);
      if (!isUniqueConflict(error)) throw error;
      const again = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, role: true },
      });
      if (again) throw this.emailConflict(again);
      throw new ConflictException({
        code: 'MECHANIC_EMAIL_EXISTS',
        message: 'A user with this email already exists.',
      });
    }
  }

  async updateMechanic(actor: AuthUser, id: string, raw: unknown): Promise<UserDto> {
    if (!isUuid(id)) throw new BadRequestException('Invalid Mechanic id');
    const parsed = adminUpdateMechanicSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;

    return this.prisma.$transaction(async (tx) => {
      // LTR-186 / D20: yesterday's clock is closed by the day close, so it does not block deactivating.
      await this.clock?.closeDue(tx);
      const current = await tx.user.findUnique({
        where: { id },
        select: mechanicSelect,
      });
      if (!current) throw new NotFoundException('Mechanic not found');
      // D48: a Manager or System Admin is changed only by a System Admin, and only its name and active flag.
      assertCanManagePerson(actor, current, input.active === false);
      const staff = isStaffRole(current.role);
      if (staff && (input.mode || input.canInspect !== undefined)) {
        throw new BadRequestException({ code: 'STAFF_TYPE_FIXED', message: 'A Manager or System Admin has no mechanic type or inspect permission to change.' });
      }
      const hasMechanicCap = current.capabilities.some((item) =>
        (MECHANIC_CAPS as readonly AppCapability[]).includes(item.capability),
      );
      if (!staff && !input.mode && !hasMechanicCap) {
        throw new BadRequestException('Choose Standard, PM or Safety before changing this person.');
      }

      // LTR-199 / D31: someone removed from the Shop stays out (to come back, they are added again).
      if (current.removedAt) {
        throw new ConflictException({ code: 'PERSON_REMOVED', message: 'This person was removed from the Shop.' });
      }

      // D22: deactivating is refused while the person has Jobs to do or labor time running.
      if (input.active === false && current.active) {
        await assertNotLastSystemAdmin(tx, current);
        const openWork = await this.openWorkOf(tx, id);
        if (openWork) throw new ConflictException(openWork);
      }

      // LTR-199 / D-SET3: a new type with Jobs of the old one still pending is refused, like deactivating.
      if (input.mode && mechanicCapability(input.mode) !== currentMechanicCapability(current)) {
        const openWork = await this.openWorkOf(tx, id);
        if (openWork) throw new ConflictException(openWork);
      }

      if (input.mode) {
        await tx.userCapability.deleteMany({
          where: { userId: id, capability: { in: [...MECHANIC_CAPS] } },
        });
        await tx.userCapability.create({
          data: {
            userId: id,
            capability: mechanicCapability(input.mode),
            grantedById: actor.id,
          },
        });
        // LTR-197 / D-SET2: a new type takes the person off the step teams they can no longer be on.
        const newCapability = mechanicCapability(input.mode);
        const memberships = await tx.shopWorkflowStepMember.findMany({ where: { userId: id }, select: { stepId: true, step: { select: { stepKey: true } } } });
        const leave = memberships.filter((membership) => workflowStepMemberCapability(membership.step.stepKey) !== toSharedCapability(newCapability));
        if (leave.length) {
          await tx.shopWorkflowStepMember.deleteMany({ where: { userId: id, stepId: { in: leave.map((membership) => membership.stepId) } } });
        }
      }

      // D41: "Can inspect trucks" is apart from the type. Safety only does QC, so a Safety person never keeps it.
      const nextCapability = input.mode ? mechanicCapability(input.mode) : currentMechanicCapability(current);
      const isSafety = !staff && nextCapability === 'QUALITY_CHECK_PERFORM';
      if (input.canInspect === true && isSafety) {
        throw new BadRequestException({ code: 'INSPECT_NOT_FOR_SAFETY', message: 'Safety does the Quality Check only; it cannot inspect trucks.' });
      }
      if (staff) {
        // D48: nothing to do; the package of a Manager or System Admin is not edited here.
      } else if (input.canInspect === false || isSafety) {
        await tx.userCapability.deleteMany({ where: { userId: id, capability: 'INSPECTION_PERFORM' } });
      } else if (input.canInspect === true) {
        await tx.userCapability.createMany({
          data: [{ userId: id, capability: 'INSPECTION_PERFORM', grantedById: actor.id }],
          skipDuplicates: true,
        });
      }

      const data: Prisma.UserUpdateInput = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.active !== undefined) data.active = input.active;
      if (Object.keys(data).length) {
        await tx.user.update({ where: { id }, data });
      }

      const updated = await tx.user.findUnique({ where: { id }, select: mechanicSelect });
      if (!updated) throw new NotFoundException('Mechanic not found');
      return toUserDto(updated);
    }).finally(invalidateAuthUserCache);
  }

  /**
   * D22: a new temporary password when the person lost the first one. Re-arms the forced change.
   * Returned once, never stored.
   */
  async resetPassword(actor: Pick<AuthUser, 'id' | 'role'>, id: string): Promise<AdminMechanicPasswordResetDto> {
    if (!isUuid(id)) throw new BadRequestException('Invalid Mechanic id');
    const current = await this.prisma.user.findUnique({ where: { id }, select: mechanicSelect });
    if (!current) throw new NotFoundException('Mechanic not found');
    // D48: a Manager's or System Admin's password is reset only by a System Admin.
    assertCanManagePerson(actor, current);
    if (!this.supabaseAdmin.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'AUTH_NOT_CONFIGURED',
        message: 'Access accounts are not managed in this environment.',
      });
    }
    // G10: a person created while this environment had no service key has no access account, and cannot sign in to
    // get one. Reset password creates it, links it and returns its temporary password, the same as at creation.
    if (!current.supabaseAuthId) {
      const account = await this.createAuthAccount(current.email, current.name);
      if (!account) throw new ServiceUnavailableException({ code: 'AUTH_NOT_CONFIGURED', message: 'Access accounts are not managed in this environment.' });
      const linked = await this.prisma.user.updateMany({ where: { id, supabaseAuthId: null }, data: { supabaseAuthId: account.authId } });
      invalidateAuthUserCache();
      if (linked.count !== 1) {
        await this.supabaseAdmin.deleteUser(account.authId).catch(() => undefined);
        throw new ConflictException({ code: 'AUTH_ACCOUNT_MISSING', message: 'This person changed while the access account was created. Try again.' });
      }
      return { temporaryPassword: account.temporaryPassword };
    }
    const temporaryPassword = generateTemporaryPassword();
    try {
      await this.supabaseAdmin.resetPassword(current.supabaseAuthId, temporaryPassword);
    } catch (error) {
      throw this.authFailure(error, 'AUTH_PASSWORD_RESET_FAILED', 'The access account could not be updated. Try again.');
    }
    return { temporaryPassword };
  }

  /** Creates the Supabase Auth user, or returns null when this environment has no service key. */
  private async createAuthAccount(email: string, name: string): Promise<{ authId: string; temporaryPassword: string } | null> {
    if (!this.supabaseAdmin.isConfigured()) return null;
    const temporaryPassword = generateTemporaryPassword();
    try {
      const { id } = await this.supabaseAdmin.createUser({ email, password: temporaryPassword, name });
      return { authId: id, temporaryPassword };
    } catch (error) {
      throw this.authFailure(error, 'AUTH_ACCOUNT_CREATE_FAILED', 'The access account could not be created. Nothing was saved; try again.');
    }
  }

  private authFailure(error: unknown, code: string, message: string) {
    if (!(error instanceof SupabaseAdminError)) return error;
    // Supabase's own message (e.g. "email address already registered") helps the Manager; the key never travels.
    return new BadGatewayException({ code, message, detail: error.message });
  }

  /** Jobs still to do on open Work Orders plus any running labor session (D22). Also used by Remove (D31). */
  async openWorkOf(tx: Prisma.TransactionClient, userId: string): Promise<AdminMechanicOpenWorkDto | null> {
    const [jobs, session] = await Promise.all([
      tx.workOrderJob.findMany({
        where: {
          assignedMechanicId: userId,
          status: 'to_do',
          workOrder: { status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
        },
        select: {
          displayName: true,
          workOrder: { select: { id: true, displayId: true, truck: { select: { truckNumber: true } } } },
        },
        orderBy: { addedAt: 'asc' },
      }),
      tx.workSession.findFirst({ where: { userId, endedAt: null }, select: { id: true } }),
    ]);
    if (!jobs.length && !session) return null;
    const pendingJobs: AdminMechanicPendingJobDto[] = jobs.map((job) => ({
      workOrderId: job.workOrder.id,
      workOrderDisplayId: job.workOrder.displayId,
      truckNumber: job.workOrder.truck.truckNumber,
      jobDisplayName: job.displayName,
    }));
    return {
      code: 'MECHANIC_HAS_OPEN_WORK',
      message: 'Reassign this person\'s pending Jobs and stop their labor time before deactivating.',
      pendingJobs,
      runningSession: Boolean(session),
    };
  }

  async createCatalogJob(actor: AuthUser, raw: unknown): Promise<AdminCatalogJobWriteDto> {
    const parsed = adminCreateCatalogJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const displayName = parsed.data.displayName;
    const status = parsed.data.status ?? CatalogStatus.ACTIVE;
    const aliasNorm = requireAliasNorm(displayName);

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.jobCategory.findUnique({
        where: { id: parsed.data.categoryId },
        select: { id: true, status: true },
      });
      if (!category) throw new NotFoundException('Category not found');
      if (category.status !== 'active') {
        throw new BadRequestException('Add jobs only to an active category.');
      }
      await this.assertDisplayNameAvailable(tx, category.id, displayName);
      await this.assertAliasAvailable(tx, aliasNorm);

      try {
        const created = await tx.catalogJob.create({
          data: {
            categoryId: category.id,
            displayName,
            status,
            createdById: actor.id,
            aliases: { create: { aliasText: displayName, aliasNorm } },
          },
          include: { aliases: { select: { aliasText: true }, orderBy: { aliasText: 'asc' } } },
        });
        return toCatalogJob(created);
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
        throw new ConflictException({
          code: 'CATALOG_JOB_EXISTS',
          message: 'That job name is already used by another catalog job.',
        });
      }
    });
  }

  async updateCatalogJob(id: string, raw: unknown): Promise<AdminCatalogJobWriteDto> {
    if (!isUuid(id)) throw new BadRequestException('Invalid Catalog Job id');
    const parsed = adminUpdateCatalogJobSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.catalogJob.findUnique({
        where: { id },
        include: { aliases: { select: { aliasText: true }, orderBy: { aliasText: 'asc' } } },
      });
      if (!current) throw new NotFoundException('Catalog job not found');

      // LTR-198 / D30: a System Job (PM A/B, Alignment, Detailing, Quality Check) is never deactivated.
      if (input.status === 'inactive' && current.status === 'active' && current.systemKey) {
        throw new ConflictException({ code: 'SYSTEM_JOB_LOCKED', message: 'This Job is part of the Shop workflow; it cannot be deactivated or deleted.' });
      }
      // SW2: a mandatory step whose Job goes inactive silently stops being added to new Work Orders.
      if (input.status === 'inactive' && current.status === 'active') {
        const step = await tx.shopWorkflowStep.findFirst({ where: { catalogJobId: id, active: true }, select: { stepKey: true } });
        if (step) {
          throw new ConflictException({
            code: 'CATALOG_JOB_IN_WORKFLOW',
            message: 'This Job is a Shop workflow step. Change the step before deactivating it.',
            stepKey: step.stepKey,
          });
        }
        // D41 / HU-M17: an active inspection check that points to this Job would have nothing to create.
        const checks = await tx.inspectionChecklistItem.count({ where: { catalogJobId: id, active: true } });
        if (checks) {
          throw new ConflictException({
            code: 'CATALOG_JOB_IN_INSPECTION_CHECKLIST',
            message: 'Inspection checks create this Job. Change them in Setup → Inspection checklist first.',
            checkCount: checks,
          });
        }
      }
      // JC3: a Job in an inactive category cannot be picked anywhere, so activating it would change nothing.
      if (input.status === 'active' && current.status !== 'active') {
        const category = await tx.jobCategory.findUnique({ where: { id: current.categoryId }, select: { status: true } });
        if (category?.status !== 'active') {
          throw new BadRequestException({
            code: 'CATALOG_CATEGORY_INACTIVE',
            message: 'This Job\'s Category is inactive, so the Job cannot be activated.',
          });
        }
      }

      const displayName = input.displayName ?? current.displayName;
      if (input.displayName && input.displayName !== current.displayName) {
        if (input.displayName.toLowerCase() !== current.displayName.toLowerCase()) {
          await this.assertDisplayNameAvailable(tx, current.categoryId, input.displayName, id);
        }
        if (input.keepOldNameAsAlias === false) {
          await this.syncDisplayNameAlias(tx, id, current.displayName, input.displayName);
        } else {
          // LTR-198 / D-SET4: the old name stays an alias, so searches and mechanics still find the Job.
          await this.addDisplayNameAlias(tx, id, input.displayName);
        }
      }

      const updated = await tx.catalogJob.update({
        where: { id },
        data: {
          ...(input.displayName ? { displayName } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        include: { aliases: { select: { aliasText: true }, orderBy: { aliasText: 'asc' } } },
      });
      return toCatalogJob(updated);
    });
  }

  private async assertDisplayNameAvailable(
    tx: CatalogClient,
    categoryId: string,
    displayName: string,
    excludeId?: string,
  ) {
    const duplicate = await tx.catalogJob.findFirst({
      where: {
        categoryId,
        displayName: { equals: displayName, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!duplicate) return;
    throw new ConflictException({
      code: 'CATALOG_JOB_EXISTS',
      message: 'A catalog job with this name already exists in the category. Update that job to rename or activate it.',
      jobId: duplicate.id,
    });
  }

  private async assertAliasAvailable(tx: CatalogClient, aliasNorm: string, jobId?: string) {
    const taken = await tx.jobAlias.findUnique({
      where: { aliasNorm },
      select: { catalogJobId: true },
    });
    if (!taken || taken.catalogJobId === jobId) return;
    throw new ConflictException({
      code: 'CATALOG_ALIAS_EXISTS',
      message: 'That job name is already used by another catalog job.',
      jobId: taken.catalogJobId,
    });
  }

  private async addDisplayNameAlias(tx: Prisma.TransactionClient, jobId: string, nextDisplayName: string) {
    const nextNorm = requireAliasNorm(nextDisplayName);
    await this.assertAliasAvailable(tx, nextNorm, jobId);
    await tx.jobAlias.createMany({
      data: [{ catalogJobId: jobId, aliasText: nextDisplayName, aliasNorm: nextNorm }],
      skipDuplicates: true,
    });
  }

  private async syncDisplayNameAlias(
    tx: Prisma.TransactionClient,
    jobId: string,
    previousDisplayName: string,
    nextDisplayName: string,
  ) {
    const nextNorm = requireAliasNorm(nextDisplayName);
    await this.assertAliasAvailable(tx, nextNorm, jobId);
    const taken = await tx.jobAlias.findUnique({ where: { aliasNorm: nextNorm }, select: { catalogJobId: true, aliasText: true } });
    const previousNorm = normalizeAlias(previousDisplayName);
    if (previousNorm && previousNorm !== nextNorm) {
      const previous = await tx.jobAlias.findUnique({
        where: { aliasNorm: previousNorm },
        select: { catalogJobId: true },
      });
      if (previous?.catalogJobId === jobId) {
        if (taken) {
          await tx.jobAlias.delete({ where: { aliasNorm: previousNorm } });
        } else {
          await tx.jobAlias.update({
            where: { aliasNorm: previousNorm },
            data: { aliasText: nextDisplayName, aliasNorm: nextNorm },
          });
          return;
        }
      }
    }
    if (!taken) {
      await tx.jobAlias.create({
        data: { catalogJobId: jobId, aliasText: nextDisplayName, aliasNorm: nextNorm },
      });
      return;
    }
    if (taken.aliasText !== nextDisplayName) {
      await tx.jobAlias.update({
        where: { aliasNorm: nextNorm },
        data: { aliasText: nextDisplayName },
      });
    }
  }

  private emailConflict(existing: { id: string; role: PrismaUserRole }): never {
    // D48: People lists Managers and System Admins too, so the existing row can always be opened.
    throw new ConflictException({
      code: 'MECHANIC_EMAIL_EXISTS',
      message: 'A person with this email already exists. Open that roster row to reactivate it or change the type.',
      mechanicId: existing.id,
    });
  }
}

function currentMechanicCapability(row: { capabilities: { capability: AppCapability }[] }): AppCapability | null {
  return row.capabilities.find((item) => (MECHANIC_CAPS as readonly AppCapability[]).includes(item.capability))?.capability ?? null;
}

export function mechanicCapability(mode: MechanicMode): AppCapability {
  switch (mode) {
    case MechanicMode.PM: return AppCapability.MECHANIC_PM;
    case MechanicMode.SAFETY: return AppCapability.QUALITY_CHECK_PERFORM;
    default: return AppCapability.MECHANIC_STANDARD;
  }
}

function requireAliasNorm(displayName: string) {
  const aliasNorm = normalizeAlias(displayName);
  if (!aliasNorm) throw new BadRequestException('Job name must include a letter or number.');
  return aliasNorm;
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function isUniqueConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
}

function toUserDto(row: MechanicRow): UserDto {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    active: row.active,
    capabilities: row.capabilities.map(({ capability }) => toSharedCapability(capability)),
  };
}

function toCatalogJob(job: {
  id: string;
  categoryId: string;
  displayName: string;
  status: string;
  aliases: { aliasText: string }[];
}): AdminCatalogJobWriteDto {
  return {
    id: job.id,
    categoryId: job.categoryId,
    displayName: job.displayName,
    status: job.status as CatalogStatus,
    aliases: job.aliases.map((alias) => alias.aliasText),
  };
}
