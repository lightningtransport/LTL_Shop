import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AppCapability } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AppCapability as SharedCapability, CatalogStatus, MechanicMode } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { SystemAdminWritesService } from './system-admin-writes.service';

const ACTOR: AuthUser = {
  id: '00000000-0000-4000-8000-0000000000aa',
  email: 'admin@lightning.local',
  name: 'Shop Administrator',
  role: 'admin',
  active: true,
  capabilities: [SharedCapability.ADMIN_ACCESS],
  supabaseAuthId: null,
};

const MECHANIC_ID = '00000000-0000-4000-8000-0000000000b1';
const CATEGORY_ID = '00000000-0000-4000-8000-0000000000c1';
const JOB_ID = '00000000-0000-4000-8000-0000000000d1';

function serviceWith(prisma: object) {
  return new SystemAdminWritesService(prisma as never);
}

describe('SystemAdminWritesService roster', () => {
  it('creates an active Standard mechanic and records who granted the cap', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: MECHANIC_ID,
          email: data.email,
          name: data.name,
          role: data.role,
          active: data.active,
          capabilities: [{ capability: data.capabilities.create.capability }],
        })),
      },
    };
    const service = serviceWith(prisma);

    await expect(service.createMechanic(ACTOR, {
      email: 'New.Mechanic@Lightning.Local',
      name: 'New Mechanic',
      mode: MechanicMode.STANDARD,
    })).resolves.toEqual({
      id: MECHANIC_ID,
      email: 'new.mechanic@lightning.local',
      name: 'New Mechanic',
      role: 'mechanic',
      active: true,
      capabilities: [SharedCapability.MECHANIC_STANDARD],
    });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        role: 'mechanic',
        active: true,
        capabilities: {
          create: {
            capability: AppCapability.MECHANIC_STANDARD,
            grantedById: ACTOR.id,
          },
        },
      }),
    }));
  });

  it('creates a PM mechanic with mechanic.pm and the compatibility flag', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: MECHANIC_ID,
          email: data.email,
          name: data.name,
          role: data.role,
          active: data.active,
          capabilities: [{ capability: data.capabilities.create.capability }],
        })),
      },
    };

    const result = await serviceWith(prisma).createMechanic(ACTOR, {
      email: 'pm@lightning.local',
      name: 'PM Mechanic',
      mode: 'pm',
    });

    expect(result.capabilities).toEqual([SharedCapability.MECHANIC_PM]);
    expect(prisma.user.create.mock.calls[0][0].data.capabilities.create.capability).toBe(AppCapability.MECHANIC_PM);
  });

  it('refuses to create a mechanic over an existing mechanic or a manager email', async () => {
    const mechanic = serviceWith({
      user: { findFirst: vi.fn().mockResolvedValue({ id: MECHANIC_ID, role: 'mechanic' }) },
    });
    await expect(mechanic.createMechanic(ACTOR, {
      email: 'mechanic@lightning.local',
      name: 'Alejandro',
      mode: 'standard',
    })).rejects.toMatchObject({
      response: { code: 'MECHANIC_EMAIL_EXISTS', mechanicId: MECHANIC_ID },
    });

    const manager = serviceWith({
      user: { findFirst: vi.fn().mockResolvedValue({ id: ACTOR.id, role: 'manager' }) },
    });
    await expect(manager.createMechanic(ACTOR, {
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      mode: 'standard',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('activates a mechanic and replaces Standard with PM', async () => {
    const current = {
      id: MECHANIC_ID,
      email: 'mechanic@lightning.local',
      name: 'Alejandro',
      role: 'mechanic',
      active: false,
      capabilities: [{ capability: AppCapability.MECHANIC_STANDARD }],
    };
    const updated = {
      ...current,
      active: true,
      capabilities: [{ capability: AppCapability.MECHANIC_PM }],
    };
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce(updated),
        update: vi.fn(),
      },
      userCapability: {
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
    };
    const service = serviceWith({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    });

    await expect(service.updateMechanic(ACTOR, MECHANIC_ID, { active: true, mode: 'pm' })).resolves.toMatchObject({
      id: MECHANIC_ID,
      active: true,
      capabilities: [SharedCapability.MECHANIC_PM],
    });
    expect(tx.userCapability.deleteMany).toHaveBeenCalledWith({
      where: { userId: MECHANIC_ID, capability: { in: [AppCapability.MECHANIC_STANDARD, AppCapability.MECHANIC_PM] } },
    });
    expect(tx.userCapability.create).toHaveBeenCalledWith({
      data: {
        userId: MECHANIC_ID,
        capability: AppCapability.MECHANIC_PM,
        grantedById: ACTOR.id,
      },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: MECHANIC_ID },
      data: { active: true },
    });
  });

  it('does not edit a manager account through the mechanic roster', async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: ACTOR.id, role: 'manager', capabilities: [] }),
        update: vi.fn(),
      },
      userCapability: { deleteMany: vi.fn(), create: vi.fn() },
    };
    const service = serviceWith({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    });

    await expect(service.updateMechanic(ACTOR, ACTOR.id, { active: true })).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.userCapability.deleteMany).not.toHaveBeenCalled();
  });

  it('requires Standard or PM when the row has no mechanic cap', async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: MECHANIC_ID,
          role: 'mechanic',
          capabilities: [],
        }),
      },
      userCapability: { deleteMany: vi.fn(), create: vi.fn() },
    };
    const service = serviceWith({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    });

    await expect(service.updateMechanic(ACTOR, MECHANIC_ID, { active: true })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SystemAdminWritesService catalog', () => {
  it('adds an active catalog job and its display-name alias to an existing category', async () => {
    const tx = {
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: CATEGORY_ID, status: 'active' }) },
      catalogJob: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: JOB_ID,
          categoryId: data.categoryId,
          displayName: data.displayName,
          status: data.status,
          aliases: [{ aliasText: data.aliases.create.aliasText }],
        })),
      },
      jobAlias: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const service = serviceWith({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    });

    await expect(service.createCatalogJob(ACTOR, {
      categoryId: CATEGORY_ID,
      displayName: 'Air hose',
    })).resolves.toEqual({
      id: JOB_ID,
      categoryId: CATEGORY_ID,
      displayName: 'Air hose',
      status: CatalogStatus.ACTIVE,
      aliases: ['Air hose'],
    });
    expect(tx.catalogJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        categoryId: CATEGORY_ID,
        displayName: 'Air hose',
        status: 'active',
        createdById: ACTOR.id,
        aliases: { create: { aliasText: 'Air hose', aliasNorm: 'airhose' } },
      }),
    }));
  });

  it('rejects a missing category, an inactive category, and a duplicate name', async () => {
    const missing = serviceWith({
      $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback({
        jobCategory: { findUnique: vi.fn().mockResolvedValue(null) },
      })),
    });
    await expect(missing.createCatalogJob(ACTOR, {
      categoryId: CATEGORY_ID,
      displayName: 'Air hose',
    })).rejects.toBeInstanceOf(NotFoundException);

    const inactive = serviceWith({
      $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback({
        jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: CATEGORY_ID, status: 'inactive' }) },
      })),
    });
    await expect(inactive.createCatalogJob(ACTOR, {
      categoryId: CATEGORY_ID,
      displayName: 'Air hose',
    })).rejects.toBeInstanceOf(BadRequestException);

    const duplicate = serviceWith({
      $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback({
        jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: CATEGORY_ID, status: 'active' }) },
        catalogJob: { findFirst: vi.fn().mockResolvedValue({ id: JOB_ID }) },
      })),
    });
    await expect(duplicate.createCatalogJob(ACTOR, {
      categoryId: CATEGORY_ID,
      displayName: 'Air hose',
    })).rejects.toMatchObject({
      response: { code: 'CATALOG_JOB_EXISTS', jobId: JOB_ID },
    });
  });

  it('renames and activates a catalog job without changing its id', async () => {
    const tx = {
      catalogJob: {
        findUnique: vi.fn().mockResolvedValue({
          id: JOB_ID,
          categoryId: CATEGORY_ID,
          displayName: 'Brake check',
          status: 'inactive',
          aliases: [{ aliasText: 'Brake check' }],
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({
          id: JOB_ID,
          categoryId: CATEGORY_ID,
          displayName: 'Brake inspect',
          status: 'active',
          aliases: [{ aliasText: 'Brake inspect' }],
        }),
      },
      jobAlias: {
        findUnique: vi.fn(async ({ where }: { where: { aliasNorm: string } }) => {
          if (where.aliasNorm === 'brakeinspect') return null;
          if (where.aliasNorm === 'brakecheck') return { catalogJobId: JOB_ID, aliasText: 'Brake check' };
          return null;
        }),
        update: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    };
    const service = serviceWith({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    });

    await expect(service.updateCatalogJob(JOB_ID, {
      displayName: 'Brake inspect',
      status: CatalogStatus.ACTIVE,
    })).resolves.toEqual({
      id: JOB_ID,
      categoryId: CATEGORY_ID,
      displayName: 'Brake inspect',
      status: CatalogStatus.ACTIVE,
      aliases: ['Brake inspect'],
    });
    expect(tx.jobAlias.update).toHaveBeenCalledWith({
      where: { aliasNorm: 'brakecheck' },
      data: { aliasText: 'Brake inspect', aliasNorm: 'brakeinspect' },
    });
    expect(tx.catalogJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: JOB_ID },
      data: { displayName: 'Brake inspect', status: 'active' },
    }));
  });
});
