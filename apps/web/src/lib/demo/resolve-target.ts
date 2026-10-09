import type { DemoTarget } from './scripts';

export type DemoTruckRef = { id: string; truckNumber: string; openWorkOrder?: { id: string } | null };

export type ResolvedTarget = { path: string } | { error: 'truck_not_found' | 'no_open_work_order'; unit: string };

/**
 * D36: a step names a truck by its unit number (the demo trucks are 601…991); the app routes by UUID and by
 * the open Work Order's id. `GET /api/trucks` already carries both, so no extra request is needed.
 */
export function resolveDemoTarget(target: DemoTarget, trucks: readonly DemoTruckRef[]): ResolvedTarget {
  if (target.kind === 'path') return { path: target.path };
  const truck = trucks.find((item) => item.truckNumber === target.unit);
  if (!truck) return { error: 'truck_not_found', unit: target.unit };
  switch (target.kind) {
    case 'adminTruck':
      return { path: `/admin/trucks/${truck.id}${target.tab === 'costs' ? '?tab=costs' : ''}` };
    case 'truckHistory':
      return { path: `/trucks/${truck.id}/history` };
    case 'adminWorkOrder':
      if (!truck.openWorkOrder) return { error: 'no_open_work_order', unit: target.unit };
      return { path: `/admin/work-orders/${truck.openWorkOrder.id}` };
    case 'workOrder':
      if (!truck.openWorkOrder) return { error: 'no_open_work_order', unit: target.unit };
      return { path: `/work-orders/${truck.openWorkOrder.id}${target.view === 'pm' ? '?view=pm' : ''}` };
  }
}

export function describeTarget(target: DemoTarget): string {
  switch (target.kind) {
    case 'path':
      return target.path;
    case 'adminTruck':
      return `Truck ${target.unit}${target.tab === 'costs' ? ' · Costs' : ''}`;
    case 'truckHistory':
      return `Truck ${target.unit} · history`;
    case 'adminWorkOrder':
      return `Work Order of ${target.unit}`;
    case 'workOrder':
      return `Work Order of ${target.unit}${target.view === 'pm' ? ' (PM)' : ''}`;
  }
}
