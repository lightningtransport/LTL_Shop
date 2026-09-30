import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogStatus,
  MechanicMode,
  UserRole,
  adminCreateCatalogJobSchema,
  adminCreateMechanicSchema,
  adminUpdateCatalogJobSchema,
  adminUpdateMechanicSchema,
  type AdminCatalogJobWriteDto,
  type UserDto,
} from '@ltl-shop/shared';
import { AppCapability, Prisma, type UserRole as PrismaUserRole } from '@prisma/client';
import type { AuthUser } from '../auth/auth.guard';
import { toSharedCapability } from '../auth/capabilities';
import { normalizeAlias } from '../job-catalog/job-catalog.service';
import { PrismaService } from '../prisma/prisma.service';

const MECHANIC_CAPS = [AppCapability.MECHANIC_STANDARD, AppCapability.MECHANIC_PM] as const;

const mechanicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  capabilities: { select: { capability: true } },
} as const;

type MechanicRow = Prisma.UserGetPayload<{ select: typeof mechanicSelect }>;
type CatalogClient = Prisma.TransactionClient | PrismaService;

/**
 * System Admin roster and catalog writes (LTR-78 / LTR-77).
 * `SystemAdminGuard` is the authorization gate (`users.role === admin`).
 * These methods do not re-check capabilities and do not invent new ones.
 *
 * Audit uses columns that already exist: `user_capabilities.granted_by_id`
 * / `granted_at` for Standard or PM, and `catalog_jobs.created_by_id` for
 * a new job. Shop login still links Supabase on the first matching email;
 * this service does not provision Supabase Auth.
 */
@Injectable()
export class SystemAdminWritesService {
  constructor(private readonly prisma: PrismaService) {}

  async createMechanic(actor: AuthUser, raw: unknown): Promise<UserDto> {
    const parsed = adminCreateMechanicSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { email, name, mode } = parsed.data;
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, role: true },
    });
    if (existing) throw this.emailConflict(existing);

    try {
      const created = await this.prisma.user.create({
        data: {
          email,
          name,
          role: 'mechanic',
          active: true,
          capabilities: {
            create: {
              capability: mechanicCapability(mode),
              grantedById: actor.id,
            },
          },
        },
        select: mechanicSelect,
      });
      return toUserDto(created);
    } catch (error) {
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
      const current = await tx.user.findUnique({
        where: { id },
        select: mechanicSelect,
      });
      if (!current || current.role !== 'mechanic') {
        throw new NotFoundException('Mechanic not found');
      }
      const hasMechanicCap = current.capabilities.some((item) =>
        (MECHANIC_CAPS as readonly AppCapability[]).includes(item.capability),
      );
      if (!input.mode && !hasMechanicCap) {
        throw new BadRequestException('Choose Standard or PM before changing this mechanic.');
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
    });
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

      const displayName = input.displayName ?? current.displayName;
      if (input.displayName && input.displayName !== current.displayName) {
        if (input.displayName.toLowerCase() !== current.displayName.toLowerCase()) {
          await this.assertDisplayNameAvailable(tx, current.categoryId, input.displayName, id);
        }
        await this.syncDisplayNameAlias(tx, id, current.displayName, input.displayName);
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
    if (existing.role === 'mechanic') {
      throw new ConflictException({
        code: 'MECHANIC_EMAIL_EXISTS',
        message: 'A mechanic with this email already exists. Update that roster row to activate it or change Standard/PM.',
        mechanicId: existing.id,
      });
    }
    throw new ConflictException({
      code: 'MECHANIC_EMAIL_EXISTS',
      message: 'This email belongs to a non-mechanic account and cannot be created as a mechanic.',
    });
  }
}

function mechanicCapability(mode: MechanicMode) {
  return mode === MechanicMode.PM ? AppCapability.MECHANIC_PM : AppCapability.MECHANIC_STANDARD;
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
