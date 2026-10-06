import { BadGatewayException, BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AppCapability } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AppCapability as SharedCapability, CatalogStatus, MechanicMode } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { SupabaseAdminClient, SupabaseAdminError } from '../auth/supabase-admin';
import { isTemporaryPasswordShape } from '../auth/temporary-password';
import { MECHANIC_CAPS, SystemAdminWritesService, mechanicCapability } from './system-admin-writes.service';

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

/** Local dev and the flow tests: no service key, so no Supabase account and `temporaryPassword: null`. */
const unconfiguredAuth = new SupabaseAdminClient(null);

function serviceWith(prisma: object, supabaseAdmin: Pick<SupabaseAdminClient, 'isConfigured'> & Partial<SupabaseAdminClient> = unconfiguredAuth) {
  return new SystemAdminWritesService(prisma as never, supabaseAdmin as SupabaseAdminClient);
}

function configuredAuth(overrides: Partial<Record<'createUser' | 'deleteUser' | 'resetPassword', ReturnType<typeof vi.fn>>> = {}) {
  return {
    isConfigured: () => true,
    createUser: overrides.createUser ?? vi.fn().mockResolvedValue({ id: 'auth-user-1' }),
    deleteUser: overrides.deleteUser ?? vi.fn().mockResolvedValue(undefined),
    resetPassword: overrides.resetPassword ?? vi.fn().mockResolvedValue(undefined),
  };
}

function createPrisma() {
  return {
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: MECHANIC_ID,
        email: data.email,
        name: data.name,
        role: data.role,
        active: data.active,
        supabaseAuthId: data.supabaseAuthId ?? null,
        capabilities: [{ capability: data.capabilities.create.capability }],
      })),
    },
  };
}

function txWith(current: Record<string, unknown>, openWork: { jobs?: unknown[]; session?: unknown } = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValueOnce(current).mockResolvedValue({ ...current, active: false }),
      update: vi.fn(),
    },
    userCapability: { deleteMany: vi.fn(), create: vi.fn() },
    workOrderJob: { findMany: vi.fn().mockResolvedValue(openWork.jobs ?? []) },
    workSession: { findFirst: vi.fn().mockResolvedValue(openWork.session ?? null) },
  };
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
      // No Supabase service key here: no access account, and the Manager is told so.
      temporaryPassword: null,
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
      where: { userId: MECHANIC_ID, capability: { in: [AppCapability.MECHANIC_STANDARD, AppCapability.MECHANIC_PM, AppCapability.QUALITY_CHECK_PERFORM] } },
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

describe('SystemAdminWritesService roster (D22)', () => {
  it('maps the three roster types to one capability each', () => {
    expect(mechanicCapability(MechanicMode.STANDARD)).toBe(AppCapability.MECHANIC_STANDARD);
    expect(mechanicCapability(MechanicMode.PM)).toBe(AppCapability.MECHANIC_PM);
    expect(mechanicCapability(MechanicMode.SAFETY)).toBe(AppCapability.QUALITY_CHECK_PERFORM);
    expect([...MECHANIC_CAPS]).toEqual([AppCapability.MECHANIC_STANDARD, AppCapability.MECHANIC_PM, AppCapability.QUALITY_CHECK_PERFORM]);
  });

  it('creates a Safety user with quality_check.perform and role mechanic', async () => {
    const prisma = createPrisma();
    const service = serviceWith(prisma);
    await expect(service.createMechanic(ACTOR, { email: 'safety-3@lightning.local', name: 'Safety Three', mode: 'safety' })).resolves.toMatchObject({
      role: 'mechanic',
      capabilities: [SharedCapability.QUALITY_CHECK_PERFORM],
      temporaryPassword: null,
    });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ supabaseAuthId: null, capabilities: { create: expect.objectContaining({ capability: AppCapability.QUALITY_CHECK_PERFORM }) } }),
    }));
  });

  it('creates the Supabase account first, stores its id, and returns the temporary password once', async () => {
    const prisma = createPrisma();
    const auth = configuredAuth();
    const service = serviceWith(prisma, auth);

    const created = await service.createMechanic(ACTOR, { email: 'ana@lightning.local', name: 'Ana', mode: 'pm' });
    expect(created.temporaryPassword).not.toBeNull();
    expect(isTemporaryPasswordShape(created.temporaryPassword!)).toBe(true);
    expect(auth.createUser).toHaveBeenCalledWith({ email: 'ana@lightning.local', password: created.temporaryPassword, name: 'Ana' });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ supabaseAuthId: 'auth-user-1' }),
    }));
    // Never persisted: the DTO carries it, the row does not.
    expect(JSON.stringify(prisma.user.create.mock.calls[0][0])).not.toContain(created.temporaryPassword);
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it('creates nothing when Supabase refuses the account (AUTH_ACCOUNT_CREATE_FAILED)', async () => {
    const prisma = createPrisma();
    const auth = configuredAuth({
      createUser: vi.fn().mockRejectedValue(new SupabaseAdminError('create', 422, 'email_exists', 'A user with this email address has already been registered')),
    });
    const service = serviceWith(prisma, auth);

    const failure = await service.createMechanic(ACTOR, { email: 'dup@lightning.local', name: 'Dup', mode: 'standard' }).catch((error) => error);
    expect(failure).toBeInstanceOf(BadGatewayException);
    expect((failure as BadGatewayException).getResponse()).toMatchObject({ code: 'AUTH_ACCOUNT_CREATE_FAILED' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('deletes the Supabase account again when the Shop row cannot be written', async () => {
    const prisma = createPrisma();
    prisma.user.create.mockRejectedValue(new Error('db down'));
    const auth = configuredAuth();
    const service = serviceWith(prisma, auth);

    await expect(service.createMechanic(ACTOR, { email: 'ana@lightning.local', name: 'Ana', mode: 'standard' })).rejects.toThrow('db down');
    expect(auth.deleteUser).toHaveBeenCalledWith('auth-user-1');
  });

  it('refuses to deactivate while the person has Jobs to do or labor time running (MECHANIC_HAS_OPEN_WORK)', async () => {
    const current = { id: MECHANIC_ID, role: 'mechanic', active: true, supabaseAuthId: null, capabilities: [{ capability: AppCapability.MECHANIC_STANDARD }] };
    const tx = txWith(current, {
      jobs: [{ displayName: 'Brake pads', workOrder: { id: 'wo-1', displayId: 'WO-0001', truck: { truckNumber: '905' } } }],
      session: { id: 'session-1' },
    });
    const service = serviceWith({ $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) });

    const failure = await service.updateMechanic(ACTOR, MECHANIC_ID, { active: false }).catch((error) => error);
    expect(failure).toBeInstanceOf(ConflictException);
    expect((failure as ConflictException).getResponse()).toEqual({
      code: 'MECHANIC_HAS_OPEN_WORK',
      message: expect.any(String),
      pendingJobs: [{ workOrderId: 'wo-1', workOrderDisplayId: 'WO-0001', truckNumber: '905', jobDisplayName: 'Brake pads' }],
      runningSession: true,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.workOrderJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assignedMechanicId: MECHANIC_ID, status: 'to_do' }),
    }));
  });

  it('deactivates when nothing is open, and reactivates without any rule', async () => {
    const current = { id: MECHANIC_ID, role: 'mechanic', active: true, supabaseAuthId: null, capabilities: [{ capability: AppCapability.QUALITY_CHECK_PERFORM }] };
    const tx = txWith(current);
    const service = serviceWith({ $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) });
    await expect(service.updateMechanic(ACTOR, MECHANIC_ID, { active: false })).resolves.toMatchObject({ active: false });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: MECHANIC_ID }, data: { active: false } });

    const inactive = { ...current, active: false };
    const tx2 = { ...txWith(inactive), user: { findUnique: vi.fn().mockResolvedValue({ ...inactive, active: true }), update: vi.fn() } };
    tx2.user.findUnique.mockResolvedValueOnce(inactive);
    const service2 = serviceWith({ $transaction: vi.fn(async (callback: (client: typeof tx2) => unknown) => callback(tx2)) });
    await expect(service2.updateMechanic(ACTOR, MECHANIC_ID, { active: true })).resolves.toMatchObject({ active: true });
    expect(tx2.workOrderJob.findMany).not.toHaveBeenCalled();
  });

  it('resets the password through Supabase and returns it once; AUTH_ACCOUNT_MISSING without an account', async () => {
    const withAccount = { id: MECHANIC_ID, email: 'ana@lightning.local', name: 'Ana', role: 'mechanic', active: true, supabaseAuthId: 'auth-user-1', capabilities: [] };
    const auth = configuredAuth();
    const service = serviceWith({ user: { findUnique: vi.fn().mockResolvedValue(withAccount) } }, auth);
    const reset = await service.resetPassword(MECHANIC_ID);
    expect(isTemporaryPasswordShape(reset.temporaryPassword)).toBe(true);
    expect(auth.resetPassword).toHaveBeenCalledWith('auth-user-1', reset.temporaryPassword);

    const noAccount = serviceWith({ user: { findUnique: vi.fn().mockResolvedValue({ ...withAccount, supabaseAuthId: null }) } }, auth);
    const missing = await noAccount.resetPassword(MECHANIC_ID).catch((error) => error);
    expect(missing).toBeInstanceOf(ConflictException);
    expect((missing as ConflictException).getResponse()).toMatchObject({ code: 'AUTH_ACCOUNT_MISSING' });

    const unconfigured = serviceWith({ user: { findUnique: vi.fn().mockResolvedValue(withAccount) } });
    await expect(unconfigured.resetPassword(MECHANIC_ID)).rejects.toBeInstanceOf(ServiceUnavailableException);

    const manager = serviceWith({ user: { findUnique: vi.fn().mockResolvedValue({ ...withAccount, role: 'manager' }) } }, auth);
    await expect(manager.resetPassword(MECHANIC_ID)).rejects.toBeInstanceOf(NotFoundException);
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

  it('D25: refuses the same Job name in the category, trimmed and case-insensitive, with the existing jobId', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: JOB_ID });
    const create = vi.fn();
    const service = serviceWith({
      $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback({
        jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: CATEGORY_ID, status: 'active' }) },
        catalogJob: { findFirst, create },
      })),
    });
    await expect(service.createCatalogJob(ACTOR, {
      categoryId: CATEGORY_ID,
      displayName: '  AIR HOSE  ',
    })).rejects.toMatchObject({
      status: 409,
      response: { code: 'CATALOG_JOB_EXISTS', jobId: JOB_ID },
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        categoryId: CATEGORY_ID,
        displayName: { equals: 'AIR HOSE', mode: 'insensitive' },
      }),
    }));
    expect(create).not.toHaveBeenCalled();
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
