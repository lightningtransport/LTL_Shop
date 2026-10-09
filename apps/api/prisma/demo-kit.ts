/**
 * What `reset-demo-work-orders.ts` hands the demo builders (`demo-history.ts`, `demo-parts-costs.ts`,
 * `demo-labor-finance.ts`): the services,
 * acting as each user, and the steps the scenarios share.
 */
import type { Priority, WorkPlanInspectionOutcome, WorkPlanJobLane } from '@ltl-shop/shared';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { WorkOrdersService } from '../src/work-orders/work-orders.service';
import type { AdminService } from '../src/admin/admin.service';
import type { YardWorkPlanService } from '../src/admin/yard-work-plan.service';
import type { QualityCheckService } from '../src/quality-check/quality-check.service';
import type { ShopWorkflowService } from '../src/admin/shop-workflow.service';
import type { PurchasesService } from '../src/parts-costs/purchases.service';
import type { OutsideRepairsService } from '../src/parts-costs/outside-repairs.service';
import type { PartsCatalogService } from '../src/parts-costs/parts-catalog.service';
import type { LaborRatesService } from '../src/parts-costs/labor-rates.service';
import type { InternalInvoicesService } from '../src/parts-costs/internal-invoices.service';
import type { CustomJobsReviewService } from '../src/admin/custom-jobs-review.service';
import type { AuthUser } from '../src/auth/auth.guard';

export type TruckRow = { id: string; truckNumber: string; make: string | null; model: string | null; mileage: number | null };

/** `generals`: every Standard mechanic who is not the Alignment or Detailing owner (`general` is the first). */
export type Actors = {
  manager: AuthUser;
  general: AuthUser;
  generals: AuthUser[];
  pm: AuthUser;
  alignment: AuthUser;
  detailing: AuthUser;
  safety: AuthUser[];
};

/** `custom`: a Custom Job — `job` is the name the Manager typed, not a catalog Job (LTR-57 reviews them). */
export type ShopJobInput = { category: string; job: string; assignee?: AuthUser; custom?: boolean; description?: string };

export type DemoKit = {
  prisma: PrismaService;
  workOrders: WorkOrdersService;
  admin: AdminService;
  workPlan: YardWorkPlanService;
  qualityCheck: QualityCheckService;
  shopWorkflow: ShopWorkflowService;
  purchases: PurchasesService;
  outsideRepairs: OutsideRepairsService;
  partsCatalog: PartsCatalogService;
  laborRates: LaborRatesService;
  internalInvoices: InternalInvoicesService;
  customJobsReview: CustomJobsReviewService;
  meta: (expectedVersion: number) => { expectedVersion: number; idempotencyKey: string };
  version: (workOrderId: string) => Promise<number>;
  createWorkOrder: (actors: Actors, truck: TruckRow, input: { priority?: Priority; notes?: string }) => Promise<string>;
  inspect: (actors: Actors, truck: TruckRow, outcome: WorkPlanInspectionOutcome) => Promise<void>;
  addShopJobs: (actors: Actors, truck: TruckRow, jobs: ShopJobInput[]) => Promise<void>;
  jobId: (workOrderId: string, displayName: string) => Promise<string>;
  laneJobId: (workOrderId: string, lane: WorkPlanJobLane) => Promise<string>;
  assignMandatory: (actors: Actors, workOrderId: string, skip?: WorkPlanJobLane[]) => Promise<void>;
  finishJob: (mechanic: AuthUser, workOrderId: string, lane: WorkPlanJobLane, notes: string) => Promise<void>;
  finishPm: (actors: Actors, truck: TruckRow, workOrderId: string, options?: { observedMileage?: number; categories?: number }) => Promise<void>;
};
