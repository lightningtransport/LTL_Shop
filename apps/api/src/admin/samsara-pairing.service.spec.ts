import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { SamsaraPairingService } from './samsara-pairing.service';

const NOW = new Date('2026-10-14T15:00:00.000Z');

function service(env: Record<string, string | undefined>, trucks: unknown[] = []) {
  const prisma = { truck: { findMany: vi.fn().mockResolvedValue(trucks) } };
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return { prisma, pairing: new SamsaraPairingService(config, prisma as unknown as PrismaService) };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('SamsaraPairingService', () => {
  it('says "not configured" without calling Samsara or the database when the token is missing', async () => {
    const fetchImpl = vi.fn();
    const { prisma, pairing } = service({});

    const result = await pairing.get(NOW, fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ status: 'not_configured', checkedAt: NOW.toISOString(), summary: null, paired: [], unpairedTrucks: [], unpairedVehicles: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(prisma.truck.findMany).not.toHaveBeenCalled();
  });

  it('says "unauthorized" when Samsara rejects the token', async () => {
    const { pairing } = service({ SAMSARA_API_TOKEN: 'bad' });
    const result = await pairing.get(NOW, vi.fn().mockResolvedValue(jsonResponse({}, 401)) as unknown as typeof fetch);

    expect(result.status).toBe('unauthorized');
  });

  it('says "unavailable" when Samsara fails', async () => {
    const { pairing } = service({ SAMSARA_API_TOKEN: 'token' });
    const result = await pairing.get(NOW, vi.fn().mockResolvedValue(jsonResponse({}, 503)) as unknown as typeof fetch);

    expect(result.status).toBe('unavailable');
  });

  it('pairs using the stored Samsara id as a digit string and only reads trucks', async () => {
    const { prisma, pairing } = service({ SAMSARA_API_TOKEN: 'token' }, [
      { id: 't1', truckNumber: '601', vin: null, samsaraId: new Prisma.Decimal('281474977075805') },
      { id: 't2', truckNumber: '614', vin: null, samsaraId: null },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          { id: '281474977075805', name: 'Cascadia A' },
          { id: '281474977075806', name: '614' },
        ],
        pagination: { endCursor: '', hasNextPage: false },
      }),
    );

    const result = await pairing.get(NOW, fetchImpl as unknown as typeof fetch);

    expect(result.status).toBe('ok');
    expect(result.paired.map((row) => [row.truck.truckNumber, row.method])).toEqual([
      ['601', 'samsara_id'],
      ['614', 'number'],
    ]);
    expect(prisma.truck.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true, truckNumber: true, vin: true, samsaraId: true } }));
  });
});
