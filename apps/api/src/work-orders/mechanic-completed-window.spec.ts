import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { MECHANIC_COMPLETED_WINDOW_DAYS, mechanicCompletedSince, WorkOrdersService } from './work-orders.service';

const mechanic: AuthUser = {
  id: '00000000-0000-4000-8000-0000000000aa',
  email: 'mg1@lightning.local',
  name: 'MG1',
  role: 'mechanic',
  active: true,
  capabilities: [AppCapability.MECHANIC_STANDARD],
  supabaseAuthId: null,
};

describe('mechanic lists bring closed Work Orders from the last 30 days only (P21, D38)', () => {
  it('computes the window from now', () => {
    expect(MECHANIC_COMPLETED_WINDOW_DAYS).toBe(30);
    const now = new Date('2026-10-31T12:00:00.000Z');
    expect(mechanicCompletedSince(now).toISOString()).toBe('2026-10-01T12:00:00.000Z');
  });

  it('asks the database for open Work Orders and only recently completed ones', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { workOrder: { findMany } };
    const service = new WorkOrdersService(prisma as never, { log: vi.fn() } as never);

    await service.listForMechanic(mechanic, 'standard');

    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['created', 'in_progress', 'waiting_paused', 'completed'] });
    expect(where.NOT.status).toBe('completed');
    const since: Date = where.NOT.completedAt.lt;
    const expected = mechanicCompletedSince().getTime();
    expect(Math.abs(since.getTime() - expected)).toBeLessThan(5_000);
  });
});
