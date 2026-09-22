import { AppCapability } from '@ltl-shop/shared';
import { AdminController } from '../admin/admin.controller';
import { WorkOrdersController } from '../work-orders/work-orders.controller';
import { CAPABILITIES_KEY } from './capabilities.decorator';

export type CapabilityBoundaryKind = 'http_guard' | 'service' | 'system_admin_role';

export type CapabilityBoundaryEntry = {
  method: string;
  path: string;
  handler: string;
  controller: 'admin' | 'work-orders';
  expected: AppCapability[];
  /** How the expected capabilities are enforced on the public HTTP path. */
  enforcement: CapabilityBoundaryKind;
  notes?: string;
};

const ADMIN = AppCapability.ADMIN_ACCESS;
const WORK_ORDERS = AppCapability.WORK_ORDERS_MANAGE;
const YARD = AppCapability.YARD_OPERATIONS_MANAGE;
const STANDARD = AppCapability.MECHANIC_STANDARD;
const PM = AppCapability.MECHANIC_PM;

/**
 * TARGET expected capabilities for every Admin / Work Order / Yard mutation.
 * Admin reads inherit class-level `admin.access` and are listed separately
 * so the matrix stays complete without implying they are mutations.
 */
export const ADMIN_MUTATION_BOUNDARIES: CapabilityBoundaryEntry[] = [
  {
    method: 'POST',
    path: '/admin/work-orders',
    handler: 'createWorkOrder',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'Manager planning create. Method re-declares admin.access because getAllAndOverride replaces class metadata.',
  },
  {
    method: 'PATCH',
    path: '/admin/work-orders/:id',
    handler: 'patchWorkOrder',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'TARGET Q4: priority and operational notes require work_orders.manage.',
  },
  {
    method: 'POST',
    path: '/admin/time-corrections',
    handler: 'correctTime',
    controller: 'admin',
    expected: [ADMIN],
    enforcement: 'http_guard',
    notes: 'V1 Admin correction of closed labor/wait segments.',
  },
  {
    method: 'POST',
    path: '/admin/jobs/:id/reopen',
    handler: 'reopenJob',
    controller: 'admin',
    expected: [ADMIN],
    enforcement: 'http_guard',
  },
  {
    method: 'POST',
    path: '/admin/jobs/:id/cancel',
    handler: 'cancelJob',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'TARGET Q7: Manager may cancel a pending Job.',
  },
  {
    method: 'POST',
    path: '/admin/jobs/:id/complete',
    handler: 'completeJob',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'LTR-38: Manager may mark a Work Plan Job complete.',
  },
  {
    method: 'POST',
    path: '/admin/work-orders/:id/reopen',
    handler: 'reopenWorkOrder',
    controller: 'admin',
    expected: [ADMIN],
    enforcement: 'http_guard',
  },
  {
    method: 'POST',
    path: '/admin/work-orders/:id/return-to-service',
    handler: 'returnToService',
    controller: 'admin',
    expected: [ADMIN],
    enforcement: 'http_guard',
  },
  {
    method: 'POST',
    path: '/admin/work-orders/:id/complete',
    handler: 'completeWorkOrder',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'TARGET Q5: Manager completes the Standard Work Order.',
  },
  {
    method: 'POST',
    path: '/admin/work-orders/:id/cancel',
    handler: 'cancelWorkOrder',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'TARGET Q5: Manager cancels the Standard Work Order.',
  },
  {
    method: 'POST',
    path: '/admin/work-orders/:id/pause',
    handler: 'pauseWorkOrder',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'Official Manager pause. Service pauseByManager does not re-check the capability.',
  },
  {
    method: 'POST',
    path: '/admin/work-orders/:id/resume',
    handler: 'resumeWorkOrder',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'Official Manager resume. Service resumeByManager does not re-check the capability.',
  },
  {
    method: 'POST',
    path: '/admin/work-orders/:id/mechanics',
    handler: 'addWorkOrderMechanic',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'TARGET Q3: Work Order team add requires work_orders.manage.',
  },
  {
    method: 'DELETE',
    path: '/admin/work-orders/:id/mechanics/:mechanicId',
    handler: 'removeWorkOrderMechanic',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'TARGET Q3: Work Order team remove requires work_orders.manage.',
  },
  {
    method: 'POST',
    path: '/admin/work-orders/:id/jobs',
    handler: 'addWorkOrderJob',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'TARGET Q8: Manager Add Job after create.',
  },
  {
    method: 'POST',
    path: '/admin/work-orders/:id/jobs/:jobId/assign',
    handler: 'assignJob',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
  },
  {
    method: 'POST',
    path: '/admin/work-orders/:id/jobs/:jobId/unassign',
    handler: 'unassignJob',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
  },
  {
    method: 'POST',
    path: '/admin/trucks/:id/readiness-assessments',
    handler: 'startReadinessAssessment',
    controller: 'admin',
    expected: [ADMIN, YARD],
    enforcement: 'http_guard',
    notes: 'Yard service methods do not re-check yard.operations.manage.',
  },
  {
    method: 'PATCH',
    path: '/admin/readiness-assessments/:id/requirements/:type',
    handler: 'updateReadinessRequirement',
    controller: 'admin',
    expected: [ADMIN, YARD],
    enforcement: 'http_guard',
  },
  {
    method: 'POST',
    path: '/admin/readiness-assessments/:id/mark-ready',
    handler: 'markReadinessReady',
    controller: 'admin',
    expected: [ADMIN, YARD],
    enforcement: 'http_guard',
  },
  {
    method: 'POST',
    path: '/admin/readiness-assessments/:id/close',
    handler: 'closeReadinessAssessment',
    controller: 'admin',
    expected: [ADMIN, YARD],
    enforcement: 'http_guard',
  },
  {
    method: 'POST',
    path: '/admin/trucks/:id/work-plan/jobs',
    handler: 'addWorkPlanJobs',
    controller: 'admin',
    expected: [ADMIN, WORK_ORDERS],
    enforcement: 'http_guard',
    notes: 'LTR-34 Slice 1: create or add jobs on the one open Work Order from Truck Detail. Reuses Manager create/add-job.',
  },
  {
    method: 'POST',
    path: '/admin/trucks/:id/work-plan/inspection',
    handler: 'recordWorkPlanInspection',
    controller: 'admin',
    expected: [ADMIN, YARD],
    enforcement: 'http_guard',
    notes: 'LTR-34 Slice 1: Inspection discovery. Dual-run writes the Phase 1 Inspection requirement; does not delete gates.',
  },
];

export const ADMIN_READ_BOUNDARIES: CapabilityBoundaryEntry[] = [
  { method: 'GET', path: '/admin/access', handler: 'access', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/dashboard', handler: 'dashboard', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/work-orders', handler: 'workOrders', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/work-orders/:id', handler: 'workOrder', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/mechanics', handler: 'mechanics', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/mechanics/:id', handler: 'mechanic', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/history', handler: 'history', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/catalog/categories', handler: 'catalogCategories', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/catalog/categories/:id', handler: 'catalogCategory', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/trucks', handler: 'listTrucks', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/yard-operations', handler: 'yardOperationsList', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  {
    method: 'GET',
    path: '/admin/yard/data-boundary',
    handler: 'yardDataBoundary',
    controller: 'admin',
    expected: [ADMIN],
    enforcement: 'http_guard',
    notes: 'LTR-70 agent-reporting proxy for Incoming/Upcoming/Work location. Presence stays UNKNOWN.',
  },
  { method: 'GET', path: '/admin/trucks/:id', handler: 'yardTruck', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/trucks/:id/work-plan', handler: 'getWorkPlan', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
  { method: 'GET', path: '/admin/trucks/:id/repair-history', handler: 'repairHistory', controller: 'admin', expected: [ADMIN], enforcement: 'http_guard' },
];

export const WORK_ORDER_READ_BOUNDARIES: CapabilityBoundaryEntry[] = [
  {
    method: 'GET',
    path: '/work-orders/:id',
    handler: 'get',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
    notes: 'Assigned mechanic.standard/pm can read. admin.access may also read. Mutations stay on assertMechanicAccess.',
  },
  {
    method: 'GET',
    path: '/work-orders/:id/pm',
    handler: 'getPm',
    controller: 'work-orders',
    expected: [PM],
    enforcement: 'service',
    notes: 'Assigned mechanic.pm can read. admin.access may also read. canEdit and POST stay mechanic.pm + assigned.',
  },
];

export const WORK_ORDER_MUTATION_BOUNDARIES: CapabilityBoundaryEntry[] = [
  {
    method: 'POST',
    path: '/work-orders',
    handler: 'create',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
    notes: 'PM create uses mechanic.pm instead. TARGET Q9: Standard create is Manager-owned and returns 403.',
  },
  {
    method: 'POST',
    path: '/work-orders/:id/start',
    handler: 'start',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
    notes: 'PM Work Orders require mechanic.pm and assignment. Enforced by assertMechanicAccess.',
  },
  {
    method: 'POST',
    path: '/work-orders/:id/pause',
    handler: 'pause',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
    notes: 'TARGET Q12: Standard pause is Manager-owned. PM pause remains authorized.',
  },
  {
    method: 'POST',
    path: '/work-orders/:id/pause-reason',
    handler: 'changePauseReason',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
    notes: 'TARGET Q12: Standard change-reason is Manager-owned. PM remains authorized.',
  },
  {
    method: 'POST',
    path: '/work-orders/:id/resume',
    handler: 'resume',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
    notes: 'TARGET Q12: Standard resume is Manager-owned. PM remains authorized.',
  },
  {
    method: 'POST',
    path: '/work-orders/:id/blockers',
    handler: 'reportBlocker',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
  },
  {
    method: 'POST',
    path: '/work-orders/:id/complete',
    handler: 'complete',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
    notes: 'TARGET Q5: Standard complete is Manager-owned. PM finish remains authorized.',
  },
  {
    method: 'POST',
    path: '/work-orders/:id/jobs',
    handler: 'addJob',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
    notes: 'TARGET Q8: Mechanic Add Job is denied. Manager uses POST /admin/work-orders/:id/jobs.',
  },
  {
    method: 'POST',
    path: '/work-orders/:id/notes',
    handler: 'updateNotes',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
  },
  {
    method: 'POST',
    path: '/work-orders/:id/jobs/:jobId/complete',
    handler: 'completeJob',
    controller: 'work-orders',
    expected: [STANDARD],
    enforcement: 'service',
  },
  {
    method: 'POST',
    path: '/work-orders/:id/pm',
    handler: 'updatePm',
    controller: 'work-orders',
    expected: [PM],
    enforcement: 'service',
  },
];

export const ALL_MUTATION_BOUNDARIES = [
  ...ADMIN_MUTATION_BOUNDARIES,
  ...WORK_ORDER_MUTATION_BOUNDARIES,
];

/**
 * LTR-77 / LTR-78. These writes are intentionally absent from
 * `ADMIN_MUTATION_BOUNDARIES`. That list treats `admin.access` as sufficient,
 * and Shop Manager already has it. The HTTP gate is `SystemAdminGuard`:
 * `users.role === admin`. Class-level `admin.access` still applies, so a
 * role-admin user without `admin.access` cannot call them either.
 * No new capability is added.
 */
export const SYSTEM_ADMIN_ROLE_WRITES: CapabilityBoundaryEntry[] = [
  {
    method: 'POST',
    path: '/admin/mechanics',
    handler: 'createMechanic',
    controller: 'admin',
    expected: [ADMIN],
    enforcement: 'system_admin_role',
    notes: 'LTR-78. role === admin. Creates an active mechanic with mechanic.standard or mechanic.pm. Manager is 403.',
  },
  {
    method: 'PATCH',
    path: '/admin/mechanics/:id',
    handler: 'updateMechanic',
    controller: 'admin',
    expected: [ADMIN],
    enforcement: 'system_admin_role',
    notes: 'LTR-78. role === admin. Activate, rename, or switch Standard/PM. Does not edit manager or admin accounts.',
  },
  {
    method: 'POST',
    path: '/admin/catalog/jobs',
    handler: 'createCatalogJob',
    controller: 'admin',
    expected: [ADMIN],
    enforcement: 'system_admin_role',
    notes: 'LTR-77. role === admin. Adds a job to an existing active category. No category create and no Custom Job review.',
  },
  {
    method: 'PATCH',
    path: '/admin/catalog/jobs/:id',
    handler: 'updateCatalogJob',
    controller: 'admin',
    expected: [ADMIN],
    enforcement: 'system_admin_role',
    notes: 'LTR-77. role === admin. Rename or activate/deactivate. Catalog job id is stable.',
  },
];

export function declaredHttpCapabilities(
  controller: object,
  handler: ((...args: never[]) => unknown) | undefined,
): AppCapability[] {
  const fromHandler = handler
    ? (Reflect.getMetadata(CAPABILITIES_KEY, handler) as AppCapability[] | undefined)
    : undefined;
  if (fromHandler?.length) return fromHandler;
  return (Reflect.getMetadata(CAPABILITIES_KEY, controller) as AppCapability[] | undefined) ?? [];
}

export function adminHandler(name: CapabilityBoundaryEntry['handler']) {
  return AdminController.prototype[name as keyof AdminController] as (...args: never[]) => unknown;
}

export function workOrderHandler(name: CapabilityBoundaryEntry['handler']) {
  return WorkOrdersController.prototype[name as keyof WorkOrdersController] as (...args: never[]) => unknown;
}
