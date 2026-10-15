import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { TrucksAdminService } from './trucks-admin.service';

const ACTOR: AuthUser = {
  id: '00000000-0000-4000-8000-0000000000aa',
  email: 'manager@lightning.local',
  name: 'Manager',
  role: 'manager',
  active: true,
  capabilities: [AppCapability.ADMIN_ACCESS, AppCapability.WORK_ORDERS_MANAGE],
  supabaseAuthId: null,
};
const TRUCK_ID = '00000000-0000-4000-8000-0000000000c1';
const VIN = '3AKJHHDR5MSMN1234';

const NO_HISTORY = {
  workOrders: 0, costEntries: 0, partPurchaseLines: 0, outsideRepairs: 0, internalInvoices: 0, inspections: 0,
  tireReadings: 0, faults: 0, mileageAdjustments: 0, serviceStatusEvents: 0, readinessAssessments: 0,
};

function truckRow(data: Record<string, unknown> = {}) {
  return {
    id: TRUCK_ID, truckNumber: '990', make: null, model: null, year: null, mileage: null, company: null, owner: null, vin: null,
    licensePlate: null, dispatcher: null, insurance: null, deactivatedAt: null, ...data,
  };
}

/** A Prisma double whose `$transaction` runs the callback on the same object (as the real client's tx does). */
function prismaWith(overrides: { current?: Record<string, unknown> | null; numberTaken?: boolean; vins?: Array<{ id: string; truckNumber: string; vin: string }>; openWorkOrder?: unknown; history?: Record<string, number> } = {}) {
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    truck: {
      findFirst: vi.fn().mockResolvedValue(overrides.numberTaken ? { id: 'other' } : null),
      findMany: vi.fn().mockResolvedValue(overrides.vins ?? []),
      findUnique: vi.fn().mockResolvedValue(overrides.current === undefined ? { ...truckRow(), _count: overrides.history ?? NO_HISTORY } : overrides.current),
      create: vi.fn(async ({ data }) => truckRow(data)),
      update: vi.fn(async ({ data }) => truckRow({ ...data, deactivatedBy: undefined })),
      delete: vi.fn().mockResolvedValue({}),
    },
    workOrder: { findFirst: vi.fn().mockResolvedValue(overrides.openWorkOrder ?? null) },
  };
  return prisma;
}

async function conflictBody(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ConflictException);
  return (error as ConflictException).getResponse() as Record<string, unknown>;
}

describe('TrucksAdminService (D44)', () => {
  it('creates a truck with only the number, empty text as null and the VIN in capitals', async () => {
    const prisma = prismaWith();
    const created = await new TrucksAdminService(prisma as never).create({ truckNumber: ' 990 ', vin: ' 3akjhhdr5msmn1234 ', make: '', year: 2021, licensePlate: 'TX-123' });

    expect(prisma.truck.create).toHaveBeenCalledWith({
      data: { truckNumber: '990', vin: VIN, make: null, model: null, year: 2021, licensePlate: 'TX-123', owner: null, company: null, dispatcher: null, insurance: null },
    });
    expect(created).toMatchObject({ truckNumber: '990', vin: VIN, licensePlate: 'TX-123', deactivatedAt: null });
  });

  it('refuses the official mileage, a year out of range and a missing number', async () => {
    const service = new TrucksAdminService(prismaWith() as never);
    await expect(service.create({ truckNumber: '990', mileage: 100 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ truckNumber: '990', year: 1900 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ truckNumber: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(ACTOR, TRUCK_ID, { mileage: 5 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a number another truck has', async () => {
    const body = await conflictBody(new TrucksAdminService(prismaWith({ numberTaken: true }) as never).create({ truckNumber: '601' }));
    expect(body.code).toBe('TRUCK_NUMBER_TAKEN');
  });

  it('refuses a VIN another truck has, ignoring dashes and case, and names that truck', async () => {
    const prisma = prismaWith({ vins: [{ id: 'other', truckNumber: '601', vin: '3akj-hhdr5-msmn1234' }] });
    const body = await conflictBody(new TrucksAdminService(prisma as never).create({ truckNumber: '990', vin: VIN }));
    expect(body).toMatchObject({ code: 'TRUCK_VIN_TAKEN', truck: { id: 'other', truckNumber: '601' } });
  });

  it('does not check a placeholder VIN', async () => {
    const prisma = prismaWith({ vins: [{ id: 'other', truckNumber: '601', vin: 'N/A' }] });
    await new TrucksAdminService(prisma as never).create({ truckNumber: '990', vin: 'N/A' });
    expect(prisma.truck.findMany).not.toHaveBeenCalled();
  });

  it('refuses to deactivate with an open Work Order and says which', async () => {
    const prisma = prismaWith({ openWorkOrder: { id: 'wo-1', displayId: 'WO-012' } });
    const body = await conflictBody(new TrucksAdminService(prisma as never).update(ACTOR, TRUCK_ID, { active: false }));
    expect(body).toMatchObject({ code: 'TRUCK_HAS_OPEN_WORK_ORDER', workOrder: { id: 'wo-1', displayId: 'WO-012' } });
    expect(prisma.truck.update).not.toHaveBeenCalled();
  });

  it('deactivates with who and when, drops a Samsara proposal, and reactivates', async () => {
    const prisma = prismaWith();
    await new TrucksAdminService(prisma as never).update(ACTOR, TRUCK_ID, { active: false });
    expect(prisma.truck.update).toHaveBeenCalledWith({
      where: { id: TRUCK_ID },
      data: { deactivatedAt: expect.any(Date), deactivatedBy: { connect: { id: ACTOR.id } }, samsaraProposedVehicleId: null },
    });

    const inactive = prismaWith({ current: { ...truckRow(), deactivatedAt: new Date('2026-10-14T12:00:00Z') } });
    await new TrucksAdminService(inactive as never).update(ACTOR, TRUCK_ID, { active: true, dispatcher: 'Ana' });
    expect(inactive.truck.update).toHaveBeenCalledWith({
      where: { id: TRUCK_ID },
      data: { dispatcher: 'Ana', deactivatedAt: null, deactivatedBy: { disconnect: true } },
    });
  });

  it('edits only the fields sent; an emptied field becomes null', async () => {
    const prisma = prismaWith();
    await new TrucksAdminService(prisma as never).update(ACTOR, TRUCK_ID, { insurance: 'Progressive', owner: '' });
    expect(prisma.truck.update).toHaveBeenCalledWith({ where: { id: TRUCK_ID }, data: { insurance: 'Progressive', owner: null } });
  });

  it('deletes only a truck without history', async () => {
    const clean = prismaWith();
    await expect(new TrucksAdminService(clean as never).delete(TRUCK_ID)).resolves.toEqual({ deleted: true });
    expect(clean.truck.delete).toHaveBeenCalledWith({ where: { id: TRUCK_ID } });

    const used = prismaWith({ history: { ...NO_HISTORY, faults: 1 } });
    const body = await conflictBody(new TrucksAdminService(used as never).delete(TRUCK_ID));
    expect(body.code).toBe('TRUCK_HAS_HISTORY');
    expect(used.truck.delete).not.toHaveBeenCalled();
  });

  it('tells the card whether it can be deleted and how Samsara stands', async () => {
    const prisma = prismaWith({ current: { samsaraVehicleId: null, samsaraVehicleName: null, samsaraProposedVehicleId: 'v-1', _count: { ...NO_HISTORY, workOrders: 2 } } });
    await expect(new TrucksAdminService(prisma as never).adminInfo(TRUCK_ID)).resolves.toEqual({
      canDelete: false,
      samsara: { connectedVehicleId: null, connectedVehicleName: null, proposedVehicleId: 'v-1' },
    });
  });
});
