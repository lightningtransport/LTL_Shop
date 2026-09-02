import { describe, expect, it, vi } from 'vitest';
import { Priority } from '@ltl-shop/shared';
import { WorkOrdersService } from './work-orders.service';

describe('PM Work Order authorization', () => {
  it('rejects PM creation by a mechanic without PM authorization', async () => {
    const prisma = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: 'truck-1' }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'pm-category', name: 'PM' }) },
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.create({
      id: 'alejandro-id', email: 'mechanic@lightning.local', name: 'Alejandro 1',
      role: 'mechanic', active: true, pmAuthorized: false, supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-4000-8000-000000000001',
      primaryCategoryId: '00000000-0000-4000-8000-000000000002',
      priority: Priority.NORMAL,
      mechanicIds: [],
      jobs: [{
        categoryId: '00000000-0000-4000-8000-000000000002',
        displayName: 'PM A Service',
      }],
    })).rejects.toThrow('Only Daniel can perform PM work');
  });

  it('does not let a PM mechanic create a non-PM Work Order', async () => {
    const prisma = {
      workOrder: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
      truck: { findUnique: vi.fn().mockResolvedValue({ id: 'truck-1' }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'brakes-category', name: 'Brakes' }) },
    } as never;
    const service = new WorkOrdersService(prisma, { log: vi.fn() } as never);

    await expect(service.create({
      id: 'daniel-id', email: 'daniel@lightning.local', name: 'Daniel',
      role: 'mechanic', active: true, pmAuthorized: true, supabaseAuthId: null,
    }, {
      truckId: '00000000-0000-4000-8000-000000000001',
      primaryCategoryId: '00000000-0000-4000-8000-000000000003',
      priority: Priority.NORMAL,
      mechanicIds: [],
      jobs: [{
        categoryId: '00000000-0000-4000-8000-000000000003',
        displayName: 'Brake Inspection',
      }],
    })).rejects.toThrow('PM mechanics can only create PM Work Orders');
  });
});
