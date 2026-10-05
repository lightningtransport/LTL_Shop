import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { SHOP_TIME_ZONE } from '../common/shop-time';
import { assertCronSecret } from './day-close.controller';
import { closeSessionsPastCutoff, sessionCloseAt, type DayCloseSettings } from './day-close';
import { LaborClockService } from './labor-clock.service';
import { closeOtherClocks } from './labor-session';
import { myClockStopped, type WorkOrderWithRelations } from './work-order.mapper';
import { WorkOrdersService } from './work-orders.service';

const shop: DayCloseSettings = { cutoffMinutes: 17 * 60, workdays: [1, 2, 3, 4, 5], timeZone: SHOP_TIME_ZONE };
const at = (iso: string) => new Date(iso);

describe('sessionCloseAt (LTR-186 / D20)', () => {
  it('a weekday session started before 5:00 p.m. closes at 5:00 p.m. that day', () => {
    // Monday 2026-10-05, 10:00 EDT (UTC-4) → 17:00 EDT = 21:00Z.
    expect(sessionCloseAt(at('2026-10-05T14:00:00Z'), shop).toISOString()).toBe('2026-10-05T21:00:00.000Z');
    // Friday 2026-10-09, 16:59 EDT: still the same day's cutoff (no weekend time).
    expect(sessionCloseAt(at('2026-10-09T20:59:00Z'), shop).toISOString()).toBe('2026-10-09T21:00:00.000Z');
  });

  it('a session started at or after the cutoff closes at 11:59:59.999 p.m. that day', () => {
    expect(sessionCloseAt(at('2026-10-05T21:00:00Z'), shop).toISOString()).toBe('2026-10-06T03:59:59.999Z');
    expect(sessionCloseAt(at('2026-10-05T22:30:00Z'), shop).toISOString()).toBe('2026-10-06T03:59:59.999Z');
  });

  it('a session started on a Saturday or Sunday closes at 11:59:59.999 p.m. that day', () => {
    expect(sessionCloseAt(at('2026-10-10T14:00:00Z'), shop).toISOString()).toBe('2026-10-11T03:59:59.999Z');
    expect(sessionCloseAt(at('2026-10-11T12:00:00Z'), shop).toISOString()).toBe('2026-10-12T03:59:59.999Z');
  });

  it('uses the shop date, not the UTC date (an evening session is still that local day)', () => {
    // Monday 2026-10-05 23:30 EDT is 2026-10-06T03:30Z (Tuesday in UTC).
    expect(sessionCloseAt(at('2026-10-06T03:30:00Z'), shop).toISOString()).toBe('2026-10-06T03:59:59.999Z');
  });

  it('follows daylight saving time in March and November', () => {
    // Friday 2026-03-06 is EST (UTC-5): 17:00 EST = 22:00Z.
    expect(sessionCloseAt(at('2026-03-06T15:00:00Z'), shop).toISOString()).toBe('2026-03-06T22:00:00.000Z');
    // Sunday 2026-03-08 springs forward (23-hour day): ends 23:59:59.999 EDT = 03:59:59.999Z.
    expect(sessionCloseAt(at('2026-03-08T14:00:00Z'), shop).toISOString()).toBe('2026-03-09T03:59:59.999Z');
    // Monday 2026-03-09 is EDT: 17:00 EDT = 21:00Z.
    expect(sessionCloseAt(at('2026-03-09T13:00:00Z'), shop).toISOString()).toBe('2026-03-09T21:00:00.000Z');
    // Friday 2026-10-30 is EDT; Sunday 2026-11-01 falls back (25-hour day) and ends 23:59:59.999 EST.
    expect(sessionCloseAt(at('2026-10-30T13:00:00Z'), shop).toISOString()).toBe('2026-10-30T21:00:00.000Z');
    expect(sessionCloseAt(at('2026-11-01T04:30:00Z'), shop).toISOString()).toBe('2026-11-02T04:59:59.999Z');
    // Monday 2026-11-02 is EST: 17:00 EST = 22:00Z.
    expect(sessionCloseAt(at('2026-11-02T14:00:00Z'), shop).toISOString()).toBe('2026-11-02T22:00:00.000Z');
  });

  it('reads a custom cutoff and custom workdays', () => {
    const custom: DayCloseSettings = { ...shop, cutoffMinutes: 14 * 60 + 30, workdays: [6] };
    // Saturday is a workday now: 14:30 EDT = 18:30Z.
    expect(sessionCloseAt(at('2026-10-10T13:00:00Z'), custom).toISOString()).toBe('2026-10-10T18:30:00.000Z');
    // Monday is not: end of that day.
    expect(sessionCloseAt(at('2026-10-05T13:00:00Z'), custom).toISOString()).toBe('2026-10-06T03:59:59.999Z');
  });
});

type MemSession = { id: string; workOrderId: string; userId: string | null; startedAt: Date; endedAt: Date | null; endReason: string | null };

/** In-memory tx with just what the clock helpers use. */
function memoryDb(sessions: MemSession[], settings = { dayCloseMinutes: 1020, workdays: [1, 2, 3, 4, 5] }) {
  const rows = sessions.map((session) => ({ ...session }));
  const matches = (session: MemSession, where: Record<string, unknown>) => {
    if ('endedAt' in where && where.endedAt === null && session.endedAt !== null) return false;
    if ('userId' in where && session.userId !== where.userId) return false;
    const workOrderId = where.workOrderId as string | { not: string } | undefined;
    if (typeof workOrderId === 'string' && session.workOrderId !== workOrderId) return false;
    if (workOrderId && typeof workOrderId === 'object' && session.workOrderId === workOrderId.not) return false;
    const id = where.id as { in: string[] } | undefined;
    if (id && !id.in.includes(session.id)) return false;
    const startedAt = where.startedAt as { lt: Date } | undefined;
    if (startedAt && !(session.startedAt < startedAt.lt)) return false;
    return true;
  };
  const totals = new Map<string, bigint>();
  const db = {
    rows,
    totals,
    workSession: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((session) => matches(session, where))),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const found = rows.find((session) => matches(session, where));
        return found ? { workOrder: { id: found.workOrderId, displayId: `WO-${found.workOrderId}`, truck: { truckNumber: `T${found.workOrderId}` } } } : null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<MemSession> }) => {
        const hit = rows.filter((session) => matches(session, where));
        hit.forEach((session) => Object.assign(session, data));
        return { count: hit.length };
      }),
    },
    pauseEvent: { findMany: vi.fn(async () => []) },
    workOrder: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { totalActiveLaborMs: bigint } }) => {
        totals.set(where.id, data.totalActiveLaborMs);
        return {};
      }),
    },
    shopSettings: {
      findUnique: vi.fn(async () => ({ id: 1, ...settings, updatedAt: new Date(), updatedBy: null })),
      upsert: vi.fn(),
      update: vi.fn(async ({ data }: { data: { dayCloseMinutes: number; workdays: number[] } }) => {
        Object.assign(settings, data);
        return { id: 1, ...settings, updatedAt: new Date(), updatedBy: null };
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
  };
  return db;
}

const session = (id: string, workOrderId: string, startedAt: string, userId: string | null = 'mech-1'): MemSession => ({
  id, workOrderId, userId, startedAt: at(startedAt), endedAt: null, endReason: null,
});

describe('closeSessionsPastCutoff (LTR-186 / D20)', () => {
  it('closes a session at its close time (not now) and marks it day_close', async () => {
    // Started Monday 14:00 EDT; nobody looked until Tuesday 08:10 EDT.
    const db = memoryDb([session('s1', 'wo-1', '2026-10-05T18:00:00Z')]);
    const result = await closeSessionsPastCutoff(db as never, at('2026-10-06T12:10:00Z'), shop);
    expect(result).toEqual({ closed: 1, workOrderIds: ['wo-1'] });
    expect(db.rows[0]).toMatchObject({ endedAt: at('2026-10-05T21:00:00Z'), endReason: 'day_close' });
    // The Work Order total counts to 5:00 p.m.: 3 hours.
    expect(db.totals.get('wo-1')).toBe(BigInt(3 * 3600_000));
  });

  it('a Friday clock forgotten over the weekend counts to Friday 5:00 p.m.', async () => {
    const db = memoryDb([session('s1', 'wo-1', '2026-10-09T19:00:00Z')]);
    await closeSessionsPastCutoff(db as never, at('2026-10-12T12:00:00Z'), shop);
    expect(db.rows[0].endedAt).toEqual(at('2026-10-09T21:00:00Z'));
  });

  it('leaves sessions that are not due yet open', async () => {
    const db = memoryDb([
      session('today', 'wo-1', '2026-10-05T13:00:00Z'),
      session('evening', 'wo-2', '2026-10-05T22:00:00Z', 'mech-2'),
    ]);
    const result = await closeSessionsPastCutoff(db as never, at('2026-10-05T20:59:59Z'), shop);
    expect(result.closed).toBe(0);
    expect(db.rows.every((row) => row.endedAt === null)).toBe(true);
    expect(db.workSession.updateMany).not.toHaveBeenCalled();
  });

  it('is idempotent: a second run closes nothing and keeps the close time', async () => {
    const db = memoryDb([session('s1', 'wo-1', '2026-10-05T18:00:00Z')]);
    await closeSessionsPastCutoff(db as never, at('2026-10-05T21:30:00Z'), shop);
    const again = await closeSessionsPastCutoff(db as never, at('2026-10-06T15:00:00Z'), shop);
    expect(again).toEqual({ closed: 0, workOrderIds: [] });
    expect(db.rows[0].endedAt).toEqual(at('2026-10-05T21:00:00Z'));
  });
});

describe('closeOtherClocks (LTR-186 / D21)', () => {
  it("closes the mechanic's clock on every other Work Order as switched_truck, now", async () => {
    const now = at('2026-10-05T16:00:00Z');
    const db = memoryDb([
      session('a', 'wo-a', '2026-10-05T13:00:00Z'),
      session('other-mechanic', 'wo-a', '2026-10-05T13:00:00Z', 'mech-2'),
    ]);
    expect(await closeOtherClocks(db as never, 'mech-1', 'wo-b', now)).toEqual(['wo-a']);
    expect(db.rows[0]).toMatchObject({ endedAt: now, endReason: 'switched_truck' });
    expect(db.rows[1].endedAt).toBeNull();
  });
});

describe('LaborClockService (LTR-186)', () => {
  it('closeDue reads the settings and closes only what is due', async () => {
    const db = memoryDb([session('s1', 'wo-1', '2026-10-05T18:00:00Z')], { dayCloseMinutes: 18 * 60, workdays: [1, 2, 3, 4, 5] });
    const clock = new LaborClockService(db as never, { log: vi.fn() } as never);
    expect((await clock.closeDue(undefined, at('2026-10-05T21:30:00Z'))).closed).toBe(0);
    expect((await clock.closeDue(undefined, at('2026-10-05T22:00:00Z'))).closed).toBe(1);
    expect(db.rows[0].endedAt).toEqual(at('2026-10-05T22:00:00Z'));
  });

  it('closeDue with no open session does not read the settings', async () => {
    const db = memoryDb([]);
    const clock = new LaborClockService(db as never, { log: vi.fn() } as never);
    await clock.closeDue();
    expect(db.shopSettings.findUnique).not.toHaveBeenCalled();
  });

  const manager = { id: 'mgr', capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE], role: 'manager' } as unknown as AuthUser;
  const mechanic = { id: 'mech-1', capabilities: [AppCapability.MECHANIC_STANDARD], role: 'mechanic' } as unknown as AuthUser;

  it('only the Manager or the System Admin changes the shop hours; it is logged', async () => {
    const db = memoryDb([]);
    const activity = { log: vi.fn() };
    const clock = new LaborClockService(db as never, activity as never);
    await expect(clock.updateShopHours(mechanic, { cutoff: '18:00', workdays: [1] })).rejects.toMatchObject({ status: 403 });
    await expect(clock.updateShopHours(manager, { cutoff: '18:30', workdays: [5, 1, 2] })).resolves.toMatchObject({
      cutoff: '18:30', workdays: [1, 2, 5], timeZone: SHOP_TIME_ZONE,
    });
    expect(activity.log).toHaveBeenCalledWith(db, expect.objectContaining({
      entityType: 'shop_settings',
      previousValue: { cutoff: '17:00', workdays: [1, 2, 3, 4, 5] },
      newValue: { cutoff: '18:30', workdays: [1, 2, 5] },
    }));
  });

  it('refuses invalid shop hours with SHOP_HOURS_INVALID', async () => {
    const clock = new LaborClockService(memoryDb([]) as never, { log: vi.fn() } as never);
    for (const body of [{ cutoff: '09:00', workdays: [1] }, { cutoff: '17:00', workdays: [] }, { cutoff: 'later', workdays: [1] }, {}]) {
      await expect(clock.updateShopHours(manager, body)).rejects.toMatchObject({ status: 400, response: { code: 'SHOP_HOURS_INVALID' } });
    }
  });
});

describe('cron secret (LTR-186)', () => {
  it('accepts only the exact bearer secret and refuses when it is not configured', () => {
    expect(() => assertCronSecret('Bearer s3cret', 's3cret')).not.toThrow();
    expect(() => assertCronSecret('Bearer wrong', 's3cret')).toThrow('Invalid cron secret.');
    expect(() => assertCronSecret(undefined, 's3cret')).toThrow('Invalid cron secret.');
    expect(() => assertCronSecret('Bearer s3cret', undefined)).toThrow('CRON_SECRET is not configured.');
    expect(() => assertCronSecret('Bearer ', '')).toThrow('CRON_SECRET is not configured.');
  });
});

function workOrder(overrides: Partial<WorkOrderWithRelations> = {}): WorkOrderWithRelations {
  return {
    id: 'wo-a', displayId: 'WO-001', truckId: 'truck-1', primaryCategoryId: 'cat', status: 'in_progress', priority: 'normal',
    notes: null, createdAt: at('2026-10-05T12:00:00Z'), createdById: 'mgr', startedAt: at('2026-10-05T13:00:00Z'),
    completedAt: null, completedById: null, totalActiveLaborMs: 0n, totalWaitingMs: 0n, version: 1,
    truck: { id: 'truck-1', truckNumber: '905', make: null, model: null, year: null, mileage: null, company: null, owner: null },
    primaryCategory: { id: 'cat', name: 'Inspection' },
    jobs: [{
      id: 'job-1', workOrderId: 'wo-a', catalogJobId: null, categoryId: 'cat', category: { id: 'cat', name: 'Alignment' },
      displayName: 'Alignment', customDescription: null, status: 'to_do', completedAt: null, completedById: null,
      assignedMechanicId: 'mech-1', assignedMechanic: { id: 'mech-1', name: 'MG' },
    }],
    pauseEvents: [],
    sessions: [],
    ...overrides,
  };
}

describe('myClockStopped (LTR-186)', () => {
  const closed = (endReason: string | null) => [{ id: 's1', startedAt: at('2026-10-05T13:00:00Z'), endedAt: at('2026-10-05T21:00:00Z'), userId: 'mech-1', endReason }];

  it('day_close: my clock stopped at the day close and I still have work here', () => {
    expect(myClockStopped(workOrder({ sessions: closed('day_close') }), 'mech-1')).toEqual({ reason: 'day_close' });
  });

  it('switched_truck: says where my clock runs now', () => {
    const elsewhere = { id: 'wo-b', displayId: 'WO-002', truckNumber: '944' };
    expect(myClockStopped(workOrder({ sessions: closed('switched_truck') }), 'mech-1', elsewhere))
      .toEqual({ reason: 'switched_truck', elsewhereWorkOrder: elsewhere });
    expect(myClockStopped(workOrder({ sessions: closed('switched_truck') }), 'mech-1', null))
      .toEqual({ reason: 'switched_truck', elsewhereWorkOrder: null });
  });

  it('nothing when my clock runs here, the stop was mine, I have no workable Job, or the WO is paused', () => {
    expect(myClockStopped(workOrder({ sessions: [...closed('day_close'), { id: 's2', startedAt: at('2026-10-06T12:00:00Z'), endedAt: null, userId: 'mech-1', endReason: null }] }), 'mech-1')).toBeNull();
    expect(myClockStopped(workOrder({ sessions: closed(null) }), 'mech-1')).toBeNull();
    expect(myClockStopped(workOrder({ sessions: closed('day_close') }), 'mech-2')).toBeNull();
    expect(myClockStopped(workOrder({ status: 'waiting_paused', sessions: closed('day_close') }), 'mech-1')).toBeNull();
  });
});

describe('Start on another Truck (LTR-186 / D21)', () => {
  const mechanic: AuthUser = {
    id: 'mech-1', email: 'mg@lightning.local', name: 'MG', role: 'mechanic', active: true,
    capabilities: [AppCapability.MECHANIC_STANDARD], supabaseAuthId: null,
  };

  it("Start on Work Order B closes the mechanic's clock on A (switched_truck) and opens it on B", async () => {
    // Monday 12:00 EDT: A's clock is not past the day close, so only D21 closes it.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at('2026-10-05T16:00:00Z'));
    const db = memoryDb([session('on-a', 'wo-a', '2026-10-05T13:00:00Z')]);
    const woB = workOrder({ id: 'wo-b', displayId: 'WO-002', sessions: [] });
    woB.jobs = woB.jobs.map((job) => ({ ...job, workOrderId: 'wo-b' }));
    const created: MemSession[] = [];
    const tx = {
      ...db,
      workOrder: {
        ...db.workOrder,
        findUnique: vi.fn(async () => woB),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if ('totalActiveLaborMs' in data) return {};
          return { ...woB, sessions: created.map((row) => ({ ...row })) };
        }),
      },
      workSession: {
        ...db.workSession,
        create: vi.fn(async ({ data }: { data: { workOrderId: string; startedAt: Date; userId: string } }) => {
          const row = { id: 'on-b', endedAt: null, endReason: null, ...data };
          created.push(row);
          db.rows.push(row);
          return row;
        }),
      },
    };
    const prisma = { ...db, $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback(tx)) };
    const clock = new LaborClockService(prisma as never, { log: vi.fn() } as never);
    const service = new WorkOrdersService(prisma as never, { log: vi.fn() } as never, clock);

    await expect(service.start(mechanic, 'wo-b')).resolves.toMatchObject({ laborRunning: true });
    expect(db.rows.find((row) => row.id === 'on-a')).toMatchObject({ endReason: 'switched_truck', endedAt: expect.any(Date) });
    expect(db.rows.filter((row) => row.userId === 'mech-1' && row.endedAt === null).map((row) => row.workOrderId)).toEqual(['wo-b']);
    vi.useRealTimers();
  });

  it('Start the next morning: yesterday\'s clock on A closes at the day close, not as a switch', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at('2026-10-06T12:30:00Z'));
    const db = memoryDb([session('on-a', 'wo-a', '2026-10-05T13:00:00Z')]);
    const clock = new LaborClockService(db as never, { log: vi.fn() } as never);
    await clock.closeDue(db as never);
    await clock.closeOtherClocks(db as never, 'mech-1', 'wo-b');
    expect(db.rows[0]).toMatchObject({ endReason: 'day_close', endedAt: at('2026-10-05T21:00:00Z') });
    vi.useRealTimers();
  });
});
