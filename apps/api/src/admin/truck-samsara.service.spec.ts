import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { SamsaraSyncService } from './samsara-sync.service';
import { TruckSamsaraService, mergeCard } from './truck-samsara.service';
import { TrucksAdminService } from './trucks-admin.service';

const TRUCK_ID = '00000000-0000-4000-8000-0000000000c1';
const VIN = '3AKJHHDR5MSMN1234';

const VEHICLES = [
  { id: 'v-1', name: 'Trailer 9', vin: null },
  { id: 'v-2', name: 'Truck 990', vin: null, make: 'Volvo' },
  { id: 'v-3', name: 'Cascadia', vin: VIN, make: 'Freightliner', model: 'Cascadia', year: '2021', licensePlate: 'TX 1' },
  { id: 'v-4', name: 'Taken', vin: null },
  { id: '281474977075805', name: 'Ninox', vin: null },
];

function samsaraFetch(status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status === 200,
    status,
    json: async () => ({ data: VEHICLES, pagination: { hasNextPage: false } }),
  }) as unknown as typeof fetch;
}

function setup(options: { truck?: Record<string, unknown>; other?: unknown; env?: Record<string, string>; syncStatus?: string | Error } = {}) {
  const truck = { id: TRUCK_ID, truckNumber: '990', vin: VIN, make: null, model: 'Cascadia', year: 2020, licensePlate: null, deactivatedAt: null, samsaraVehicleId: null, samsaraProposedVehicleId: 'v-3', ...options.truck };
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    truck: {
      findUnique: vi.fn().mockResolvedValue(truck),
      findFirst: vi.fn().mockResolvedValue(options.other ?? null),
      findMany: vi.fn().mockImplementation(async ({ where }) => (where.vin ? [] : [
        { samsaraVehicleId: 'v-4', samsaraId: null },
        { samsaraVehicleId: null, samsaraId: new Prisma.Decimal('281474977075805') },
      ])),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const env = options.env ?? { SAMSARA_API_TOKEN: 'token' };
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  const sync = {
    run: vi.fn(async () => {
      if (options.syncStatus instanceof Error) throw options.syncStatus;
      return { status: options.syncStatus ?? 'ok', state: null };
    }),
  } as unknown as SamsaraSyncService;
  const trucksAdmin = new TrucksAdminService(prisma as unknown as PrismaService);
  return { prisma, sync, service: new TruckSamsaraService(config, prisma as unknown as PrismaService, trucksAdmin, sync) };
}

describe('mergeCard (D44 §4)', () => {
  const vehicle = { id: 'v', name: 'X', vin: VIN.toLowerCase(), make: 'Freightliner', model: 'Cascadia', year: 2021, licensePlate: 'TX 1' };

  it('fills what is empty, leaves what matches, and asks where the two differ', () => {
    const result = mergeCard({ vin: VIN, make: null, model: 'cascadia', year: 2020, licensePlate: '' }, vehicle, {});
    expect(result).toEqual({ data: { make: 'Freightliner', licensePlate: 'TX 1' }, filled: ['make', 'licensePlate'], needChoice: ['year'] });
  });

  it('takes Samsara only where the Manager chose it', () => {
    expect(mergeCard({ vin: 'OTHERVIN123456789', make: 'Volvo', model: null, year: 2020, licensePlate: null }, vehicle, { vin: 'samsara', make: 'ours', year: 'samsara' })).toEqual({
      data: { vin: VIN, model: 'Cascadia', year: 2021, licensePlate: 'TX 1' },
      filled: ['vin', 'model', 'year', 'licensePlate'],
      needChoice: [],
    });
  });

  it("reads Samsara's Make / Model with the same rule as the truck form (LTR-113)", () => {
    const merged = { id: 'v', name: 'X', vin: null, make: 'MACK ANTHEM', model: null };
    expect(mergeCard({ vin: VIN, make: null, model: null, year: null, licensePlate: null }, merged, {}).data).toEqual({ make: 'Mack', model: 'ANTHEM' });
    expect(mergeCard({ vin: VIN, make: 'Mack', model: 'Anthem', year: null, licensePlate: null }, merged, {}).filled).toEqual([]);
  });

  it('never empties a field Samsara does not know', () => {
    expect(mergeCard({ vin: VIN, make: 'Volvo', model: null, year: null, licensePlate: null }, { id: 'v', name: 'X', vin: null }, {}).filled).toEqual([]);
  });
});

describe('TruckSamsaraService (D44 §3–4)', () => {
  it('lists the vehicles no other truck has, the VIN match first, then the number match', async () => {
    const { service } = setup();
    const result = await service.candidates(TRUCK_ID, samsaraFetch());

    expect(result.items.map((item) => [item.id, item.suggested])).toEqual([['v-3', 'vin'], ['v-2', 'number'], ['v-1', null]]);
    expect(result.items[0]).toMatchObject({ make: 'Freightliner', model: 'Cascadia', year: 2021, licensePlate: 'TX 1' });
    expect(result.proposedVehicleId).toBe('v-3');
  });

  it('says why when Samsara is not configured or does not answer', async () => {
    const missing = await setup({ env: {} }).service.candidates(TRUCK_ID, samsaraFetch()).catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(ServiceUnavailableException);
    expect((missing as ServiceUnavailableException).getResponse()).toMatchObject({ code: 'SAMSARA_NOT_CONFIGURED' });
    const down = await setup().service.candidates(TRUCK_ID, samsaraFetch(503)).catch((error: unknown) => error);
    expect((down as ServiceUnavailableException).getResponse()).toMatchObject({ code: 'SAMSARA_UNAVAILABLE' });
  });

  it('refuses a vehicle another truck has', async () => {
    const { service, prisma } = setup({ other: { id: 'other', truckNumber: '601' } });
    const error = await service.connect(TRUCK_ID, { vehicleId: 'v-3', choose: { year: 'ours' } }, samsaraFetch()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'SAMSARA_VEHICLE_TAKEN', truck: { truckNumber: '601' } });
    expect(prisma.truck.update).not.toHaveBeenCalled();
  });

  it('asks for a choice where the card and Samsara differ', async () => {
    const { service, prisma } = setup();
    const error = await service.connect(TRUCK_ID, { vehicleId: 'v-3' }, samsaraFetch()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'SAMSARA_CHOICE_REQUIRED', fields: ['year'] });
    expect(prisma.truck.update).not.toHaveBeenCalled();
  });

  it('connects, fills the empty fields, drops the proposal and syncs right away', async () => {
    const { service, prisma, sync } = setup();
    const result = await service.connect(TRUCK_ID, { vehicleId: 'v-3', choose: { year: 'ours' } }, samsaraFetch());

    expect(prisma.truck.update).toHaveBeenCalledWith({
      where: { id: TRUCK_ID },
      data: { make: 'Freightliner', licensePlate: 'TX 1', samsaraVehicleId: 'v-3', samsaraVehicleName: 'Cascadia', samsaraProposedVehicleId: null },
    });
    expect(result).toEqual({ connectedVehicleId: 'v-3', connectedVehicleName: 'Cascadia', updatedFields: ['make', 'licensePlate'], synced: true });
    expect(sync.run).toHaveBeenCalledWith('manual', expect.any(Date), expect.any(Function));
  });

  it('keeps the connection when the sync after it fails', async () => {
    const { service, prisma } = setup({ syncStatus: new Error('boom') });
    const result = await service.connect(TRUCK_ID, { vehicleId: 'v-3', choose: { year: 'samsara' } }, samsaraFetch());
    expect(result.synced).toBe(false);
    expect(prisma.truck.update).toHaveBeenCalled();
  });

  it('refuses a deactivated truck', async () => {
    const { service } = setup({ truck: { deactivatedAt: new Date() } });
    const error = await service.connect(TRUCK_ID, { vehicleId: 'v-2' }, samsaraFetch()).catch((caught: unknown) => caught);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'TRUCK_INACTIVE' });
  });

  it('disconnects and forgets the Ninox Samsara id so the sync does not connect it again', async () => {
    const { service, prisma } = setup();
    await expect(service.disconnect(TRUCK_ID)).resolves.toEqual({ disconnected: true });
    expect(prisma.truck.update).toHaveBeenCalledWith({
      where: { id: TRUCK_ID },
      data: { samsaraVehicleId: null, samsaraVehicleName: null, samsaraId: null, samsaraProposedVehicleId: null },
    });
  });
});
