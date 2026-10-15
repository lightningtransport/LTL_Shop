import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { PrismaService } from '../prisma/prisma.service';
import { DevDemoController } from './dev-demo.controller';

describe('GET /api/dev/demo/users (D36)', () => {
  it('lists active, non-removed users with shared capability names', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'u1',
        name: 'Shop Manager',
        email: 'manager@lightning.local',
        role: 'manager',
        active: true,
        capabilities: [{ capability: 'ADMIN_ACCESS' }, { capability: 'WORK_ORDERS_MANAGE' }],
      },
    ]);
    // LTR-211: the first Work Order's id names the demo build.
    const findFirst = vi.fn().mockResolvedValue({ id: 'wo-build-1' });
    const prisma = { user: { findMany }, workOrder: { findFirst } } as unknown as PrismaService;

    const result = await new DevDemoController(prisma).users();

    expect(findMany.mock.calls[0][0].where).toEqual({ active: true, removedAt: null });
    expect(result).toEqual({
      build: 'wo-build-1',
      users: [
        {
          id: 'u1',
          name: 'Shop Manager',
          email: 'manager@lightning.local',
          role: 'manager',
          active: true,
          capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE],
        },
      ],
    });
  });
});
