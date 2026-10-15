import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OPEN_WORK_ORDER_STATUSES,
  adminCreateTruckSchema,
  adminUpdateTruckSchema,
  normalizeMakeModel,
  type AdminTruckAdminDto,
  type AdminTruckOpenWorkOrderConflictDto,
  type TruckDto,
} from '@ltl-shop/shared';
import type { Prisma, WorkOrderStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.guard';
import { lockTruckMutation } from '../common/truck-mutation-lock';
import { normalizeVin } from '../integrations/samsara/samsara-pairing';
import { PrismaService } from '../prisma/prisma.service';
import { toTruckDto } from '../trucks/trucks.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DbClient = Prisma.TransactionClient | PrismaService;

/** D44: everything a truck can have behind it. Any of these means history, so the truck is deactivated, not deleted. */
const HISTORY_COUNT = {
  workOrders: true,
  costEntries: true,
  partPurchaseLines: true,
  outsideRepairs: true,
  internalInvoices: true,
  inspections: true,
  tireReadings: true,
  faults: true,
  mileageAdjustments: true,
  serviceStatusEvents: true,
  readinessAssessments: true,
} as const;

/**
 * D44 / HU-M18 (LTR-215): the Manager and the System Admin create and edit trucks, like the people (D22/D31).
 * - **Create / edit**: the number is required and unique (`TRUCK_NUMBER_TAKEN`); a VIN already on another truck is
 *   refused with that truck (`TRUCK_VIN_TAKEN`). `mileage` is never written here (the PM's, D10).
 * - **Deactivate** (`active: false`): refused with the open Work Order (`TRUCK_HAS_OPEN_WORK_ORDER`). The truck leaves
 *   the lists, New Work Order and the Samsara sync; its history stays. Reactivating brings it back.
 * - **Delete**: only a truck that never had anything (`TRUCK_HAS_HISTORY` otherwise).
 * `ManagerWritesGuard` is the gate. The activity log is per Work Order, so these writes keep who deactivated instead.
 */
@Injectable()
export class TrucksAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async create(raw: unknown): Promise<TruckDto> {
    const parsed = adminCreateTruckSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;
    // LTR-113: swapped or merged Make / Model are put right before they are saved.
    const vehicle = normalizeMakeModel(input.make, input.model);
    return this.prisma.$transaction(async (tx) => {
      await this.assertNumberFree(tx, input.truckNumber);
      await this.assertVinFree(tx, input.vin ?? null);
      try {
        const created = await tx.truck.create({
          data: {
            truckNumber: input.truckNumber,
            vin: input.vin ?? null,
            make: vehicle.make,
            model: vehicle.model,
            year: input.year ?? null,
            licensePlate: input.licensePlate ?? null,
            owner: input.owner ?? null,
            company: input.company ?? null,
            dispatcher: input.dispatcher ?? null,
            insurance: input.insurance ?? null,
          },
        });
        return toTruckDto(created);
      } catch (error) {
        if (isUniqueConflict(error)) throw numberTaken();
        throw error;
      }
    });
  }

  async update(actor: AuthUser, id: string, raw: unknown): Promise<TruckDto> {
    assertUuid(id);
    const parsed = adminUpdateTruckSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { active, ...fields } = parsed.data;
    return this.prisma.$transaction(async (tx) => {
      // Same lock as New Work Order: a Work Order cannot open while the truck is being deactivated.
      await lockTruckMutation(tx, id);
      const current = await tx.truck.findUnique({ where: { id }, select: { id: true, truckNumber: true, vin: true, make: true, model: true, deactivatedAt: true } });
      if (!current) throw new NotFoundException('Truck not found');

      if (fields.truckNumber !== undefined && fields.truckNumber !== current.truckNumber) await this.assertNumberFree(tx, fields.truckNumber, id);
      if (fields.vin !== undefined && normalizeVin(fields.vin) !== normalizeVin(current.vin)) await this.assertVinFree(tx, fields.vin, id);

      const data: Prisma.TruckUpdateInput = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) (data as Record<string, unknown>)[key] = value;
      }
      if (fields.make !== undefined || fields.model !== undefined) {
        // LTR-113: one field may change alone; the rule reads the pair as it will be saved.
        const vehicle = normalizeMakeModel(
          fields.make !== undefined ? fields.make : current.make,
          fields.model !== undefined ? fields.model : current.model,
        );
        data.make = vehicle.make;
        data.model = vehicle.model;
      }
      if (active === false && !current.deactivatedAt) {
        const open = await tx.workOrder.findFirst({
          where: { truckId: id, status: { in: OPEN_WORK_ORDER_STATUSES as WorkOrderStatus[] } },
          select: { id: true, displayId: true },
          orderBy: { createdAt: 'desc' },
        });
        if (open) {
          throw new ConflictException({
            code: 'TRUCK_HAS_OPEN_WORK_ORDER',
            message: `Close or cancel ${open.displayId} before deactivating this truck.`,
            workOrder: { id: open.id, displayId: open.displayId },
          } satisfies AdminTruckOpenWorkOrderConflictDto);
        }
        data.deactivatedAt = new Date();
        data.deactivatedBy = { connect: { id: actor.id } };
        // D44: out of the fleet, out of the sync's proposals too.
        data.samsaraProposedVehicleId = null;
      }
      if (active === true && current.deactivatedAt) {
        data.deactivatedAt = null;
        data.deactivatedBy = { disconnect: true };
      }

      try {
        const updated = await tx.truck.update({ where: { id }, data });
        return toTruckDto(updated);
      } catch (error) {
        if (isUniqueConflict(error)) throw numberTaken();
        throw error;
      }
    });
  }

  async delete(id: string) {
    assertUuid(id);
    return this.prisma.$transaction(async (tx) => {
      await lockTruckMutation(tx, id);
      const truck = await tx.truck.findUnique({ where: { id }, select: { id: true, _count: { select: HISTORY_COUNT } } });
      if (!truck) throw new NotFoundException('Truck not found');
      if (historyCount(truck._count)) {
        throw new ConflictException({
          code: 'TRUCK_HAS_HISTORY',
          message: 'This truck has history in the Shop, so it cannot be deleted. Deactivate it instead.',
        });
      }
      await tx.truck.delete({ where: { id } });
      return { deleted: true as const };
    });
  }

  /** D44: what the truck's card offers the Manager: delete (only without history) and the Samsara connection. */
  async adminInfo(id: string): Promise<AdminTruckAdminDto> {
    assertUuid(id);
    const truck = await this.prisma.truck.findUnique({
      where: { id },
      select: { samsaraVehicleId: true, samsaraVehicleName: true, samsaraProposedVehicleId: true, _count: { select: HISTORY_COUNT } },
    });
    if (!truck) throw new NotFoundException('Truck not found');
    return {
      canDelete: historyCount(truck._count) === 0,
      samsara: {
        connectedVehicleId: truck.samsaraVehicleId,
        connectedVehicleName: truck.samsaraVehicleName,
        proposedVehicleId: truck.samsaraVehicleId ? null : truck.samsaraProposedVehicleId,
      },
    };
  }

  private async assertNumberFree(db: DbClient, truckNumber: string, exceptId?: string) {
    const other = await db.truck.findFirst({
      where: { truckNumber: { equals: truckNumber, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (other) throw numberTaken(other.id);
  }

  /** The VIN is compared without spaces, dashes or case; a placeholder shorter than a VIN is not compared. */
  async assertVinFree(db: DbClient, vin: string | null, exceptId?: string) {
    const normalized = normalizeVin(vin);
    if (!normalized) return;
    const others = await db.truck.findMany({
      where: { vin: { not: null }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true, truckNumber: true, vin: true },
    });
    const other = others.find((truck) => normalizeVin(truck.vin) === normalized);
    if (other) {
      throw new ConflictException({
        code: 'TRUCK_VIN_TAKEN',
        message: `Truck ${other.truckNumber} already has this VIN.`,
        truck: { id: other.id, truckNumber: other.truckNumber },
      });
    }
  }
}

function historyCount(counts: Record<string, number>) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function numberTaken(otherId?: string) {
  return new ConflictException({
    code: 'TRUCK_NUMBER_TAKEN',
    message: 'Another truck already has this number.',
    ...(otherId ? { truck: { id: otherId } } : {}),
  });
}

function assertUuid(id: string) {
  if (!UUID.test(id)) throw new BadRequestException('Invalid Truck id');
}

function isUniqueConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
}
