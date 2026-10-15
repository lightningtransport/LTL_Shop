import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { SamsaraSyncService } from './samsara-sync.service';

const NOW = new Date('2026-10-14T15:00:00.000Z');
const VIN = '3AKJHHDR5MSMN1234';

function truck(id: string, truckNumber: string, data: Record<string, unknown> = {}) {
  return { id, truckNumber, vin: null, samsaraId: null, samsaraVehicleId: null, deactivatedAt: null, owner: null, company: null, mileage: null, ...data };
}

function samsaraFetch(vehicles: unknown[]) {
  return vi.fn((url: URL) => Promise.resolve({
    ok: true,
    status: 200,
    json: async () => (url.pathname === '/fleet/vehicles'
      ? { data: vehicles, pagination: { hasNextPage: false } }
      : { data: [], pagination: { hasNextPage: false } }),
  })) as unknown as typeof fetch;
}

/** Runs one sync against a Prisma double and returns every SQL statement it sent, as text plus values. */
async function runSync(trucks: unknown[], vehicles: unknown[]) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const record = (query: Prisma.Sql) => statements.push({ sql: query.sql, values: query.values });
  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = Prisma.sql(strings, ...values);
      record(query);
      if (query.sql.includes('pg_try_advisory_xact_lock')) return [{ locked: true }];
      // RETURNING: every truck in the VALUES list "was still as read".
      return query.values.filter((value) => typeof value === 'string' && /^t\d$/.test(value)).map((id) => ({ id }));
    }),
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      record(Prisma.sql(strings, ...values));
      return 0;
    }),
    truck: { updateMany: vi.fn() },
    truckFault: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    workOrderJobSource: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const prisma = {
    truck: { findMany: vi.fn().mockResolvedValue(trucks) },
    $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
    truckFault: { count: vi.fn().mockResolvedValue(0) },
    samsaraSyncState: { upsert: vi.fn(async ({ update }) => ({ id: 1, ...update })), findUnique: vi.fn() },
  };
  const config = { get: (key: string) => ({ SAMSARA_API_TOKEN: 'token' } as Record<string, string>)[key] } as unknown as ConfigService;
  const result = await new SamsaraSyncService(config, prisma as unknown as PrismaService).run('manual', NOW, samsaraFetch(vehicles));
  return { result, statements, tx };
}

describe('SamsaraSyncService (D44: the sync only proposes)', () => {
  it('stores a Ninox-id connection, keeps a stored one whose vehicle disappeared, and never nulls a connection', async () => {
    const { result, statements, tx } = await runSync(
      [truck('t1', '601', { samsaraId: new Prisma.Decimal('100') }), truck('t2', '602', { samsaraVehicleId: 'gone' })],
      [{ id: '100', name: 'Truck 601' }],
    );

    expect(result.status).toBe('ok');
    const update = statements.find((statement) => statement.sql.includes('"samsara_vehicle_id" = v.vehicle_id'))!;
    expect(update.values).toEqual(expect.arrayContaining(['t1', '100', 'Truck 601']));
    expect(update.values).not.toContain('t2');
    expect(tx.truck.updateMany).not.toHaveBeenCalled();
    expect(statements.some((statement) => /"samsara_vehicle_id" = NULL/.test(statement.sql))).toBe(false);
  });

  it('proposes an exact VIN match without connecting it, and never proposes by number', async () => {
    const { statements } = await runSync(
      [truck('t1', '990', { vin: VIN }), truck('t2', '991')],
      [{ id: 'v-9', name: 'Cascadia', vin: VIN }, { id: 'v-8', name: 'Truck 991' }],
    );

    expect(statements.some((statement) => statement.sql.includes('"samsara_vehicle_id" = v.vehicle_id'))).toBe(false);
    const propose = statements.find((statement) => statement.sql.includes('SET "samsara_proposed_vehicle_id" = v.vehicle_id'))!;
    expect(propose.values).toEqual(['t1', 'v-9']);
    const clear = statements.find((statement) => statement.sql.includes('SET "samsara_proposed_vehicle_id" = NULL'))!;
    expect(clear.values).toEqual(['t1']);
  });

  it('skips a deactivated truck: no readings, no proposal', async () => {
    const { statements } = await runSync(
      [truck('t1', '601', { samsaraVehicleId: '100', deactivatedAt: new Date() }), truck('t2', '990', { vin: VIN, deactivatedAt: new Date() })],
      [{ id: '100', name: 'Truck 601' }, { id: 'v-9', name: 'X', vin: VIN }],
    );

    expect(statements.some((statement) => statement.sql.includes('"samsara_vehicle_id" = v.vehicle_id'))).toBe(false);
    expect(statements.some((statement) => statement.sql.includes('SET "samsara_proposed_vehicle_id" = v.vehicle_id'))).toBe(false);
  });
});
