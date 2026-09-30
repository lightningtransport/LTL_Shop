import { describe, expect, it, vi } from 'vitest';
import { AppCapability } from '@ltl-shop/shared';
import type { AuthUser } from '../auth/auth.guard';
import { assertPmObservedMileage } from './pm-mileage.guard';
import { WorkOrdersService } from './work-orders.service';

const pmMechanic: AuthUser = {
  id: 'mpm-id',
  email: 'mpm@lightning.local',
  name: 'MPM',
  role: 'mechanic',
  active: true,
  capabilities: [AppCapability.MECHANIC_PM],
  supabaseAuthId: null,
};

describe('assertPmObservedMileage (LTR-135)', () => {
  it('rejects a mileage below the truck odometer with the reference value', () => {
    expect(() => assertPmObservedMileage(364_400, 365_686, { confirmLargeJump: false })).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'MILEAGE_BELOW_CURRENT', currentMileage: 365_686 }),
      }),
    );
  });

  it('requires confirmation for a jump above 50,000 mi', () => {
    expect(() => assertPmObservedMileage(420_000, 365_686, { confirmLargeJump: false })).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'MILEAGE_JUMP_CONFIRMATION_REQUIRED' }),
      }),
    );
    expect(() => assertPmObservedMileage(420_000, 365_686, { confirmLargeJump: true })).not.toThrow();
  });

  it('accepts a normal reading', () => {
    expect(() => assertPmObservedMileage(366_100, 365_686, { confirmLargeJump: false })).not.toThrow();
  });
});

function pmWorkOrder(truckMileage: number | null) {
  return {
    id: 'wo-pm', truckId: 'truck-601', status: 'in_progress',
    truck: { id: 'truck-601', truckNumber: '601', mileage: truckMileage, make: 'Mack', model: 'Anthem', year: 2024 },
    primaryCategory: { id: 'pm-category', name: 'PM' },
    mechanics: [{ mechanicId: pmMechanic.id, removedAt: null }],
  };
}

describe('PM service mileage save / finish (LTR-135)', () => {
  it('does not save a PM observed mileage below the truck mileage', async () => {
    const tx = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(pmWorkOrder(365_686)) },
      part: { findMany: vi.fn().mockResolvedValue([]) },
      pmService: { upsert: vi.fn() },
    };
    const service = new WorkOrdersService({
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never, { log: vi.fn() } as never);

    await expect(service.updatePmService(pmMechanic, 'wo-pm', { observedMileage: 364_400, selections: [] }))
      .rejects.toMatchObject({ response: { code: 'MILEAGE_BELOW_CURRENT' } });
    expect(tx.pmService.upsert).not.toHaveBeenCalled();
  });
});
