import { z } from 'zod';

/**
 * D41: the inspection sheet — sections, results, the 10 tire positions and the tire rule.
 * The API and the web both read the tire status from `tireReadingStatus`, so a tire is never
 * "watch" on the screen and "fix" on the saved report.
 */

export enum InspectionSection {
  INTERIOR = 'interior',
  ENGINE = 'engine',
  EXTERIOR = 'exterior',
}

export const INSPECTION_SECTIONS = [InspectionSection.INTERIOR, InspectionSection.ENGINE, InspectionSection.EXTERIOR] as const;

export enum InspectionItemResult {
  OK = 'ok',
  DEFECT = 'defect',
  NA = 'na',
}

/** Steer (LF, RF) and two drive axles with duals — the trucks the shop has today (trailers later). */
export enum TirePosition {
  LF = 'LF',
  RF = 'RF',
  LFO = 'LFO',
  LFI = 'LFI',
  RFI = 'RFI',
  RFO = 'RFO',
  LRO = 'LRO',
  LRI = 'LRI',
  RRI = 'RRI',
  RRO = 'RRO',
}

/** The order "Next tire" walks around the truck. */
export const TIRE_POSITIONS = [
  TirePosition.LF,
  TirePosition.RF,
  TirePosition.LFO,
  TirePosition.LFI,
  TirePosition.RFI,
  TirePosition.RFO,
  TirePosition.LRO,
  TirePosition.LRI,
  TirePosition.RRI,
  TirePosition.RRO,
] as const;

export type TireAxle = 'steer' | 'drive';

export function tireAxle(position: TirePosition): TireAxle {
  return position === TirePosition.LF || position === TirePosition.RF ? 'steer' : 'drive';
}

export enum TireReadingStatus {
  OK = 'ok',
  /** Near the limit: shown on the Truck, no Job. */
  WATCH = 'watch',
  /** Creates Flat Repair (pressure) or Tires (tread). */
  FIX = 'fix',
}

export enum WorkOrderJobSourceKind {
  INSPECTION_ITEM = 'inspection_item',
  TIRE_READING = 'tire_reading',
  /** D42 / Samsara S-6. */
  SAMSARA_FAULT = 'samsara_fault',
}

export type InspectionTireLimits = {
  steerTargetPsi: number;
  driveTargetPsi: number;
  steerMinTread: number;
  driveMinTread: number;
  watchPct: number;
  fixPct: number;
};

/** D41 defaults: 110 / 95 PSI, 4/32 and 2/32 tread (DOT), watch at ±10 %, fix at ±20 %. */
export const DEFAULT_INSPECTION_TIRE_LIMITS: InspectionTireLimits = {
  steerTargetPsi: 110,
  driveTargetPsi: 95,
  steerMinTread: 4,
  driveMinTread: 2,
  watchPct: 10,
  fixPct: 20,
};

/** Tread this many 32nds above the minimum still counts as "watch". */
export const TIRE_TREAD_WATCH_MARGIN = 2;

export function tireTargets(position: TirePosition, limits: InspectionTireLimits) {
  return tireAxle(position) === 'steer'
    ? { targetPsi: limits.steerTargetPsi, minTread: limits.steerMinTread }
    : { targetPsi: limits.driveTargetPsi, minTread: limits.driveMinTread };
}

export type TireStatusResult = {
  status: TireReadingStatus;
  /** What makes it fix/watch; a Job is only created for `fix`. */
  reason: 'pressure' | 'tread' | null;
};

/**
 * D41 tire rule. Pressure: beyond ±fixPct of target → fix, beyond ±watchPct → watch.
 * Tread: under the minimum → fix, less than 2/32 above it → watch. The worse of the two wins;
 * on a tie, tread wins (a worn tire is replaced, a low one is repaired).
 */
export function tireReadingStatus(
  reading: { psi: number; tread: number },
  target: { targetPsi: number; minTread: number },
  limits: Pick<InspectionTireLimits, 'watchPct' | 'fixPct'>,
): TireStatusResult {
  const off = (Math.abs(reading.psi - target.targetPsi) / target.targetPsi) * 100;
  const pressure = off > limits.fixPct ? 2 : off > limits.watchPct ? 1 : 0;
  const tread = reading.tread < target.minTread ? 2 : reading.tread < target.minTread + TIRE_TREAD_WATCH_MARGIN ? 1 : 0;
  const level = Math.max(pressure, tread);
  const status = level === 2 ? TireReadingStatus.FIX : level === 1 ? TireReadingStatus.WATCH : TireReadingStatus.OK;
  const reason = level === 0 ? null : tread >= pressure ? 'tread' : 'pressure';
  return { status, reason };
}

// ───────────────────────── Requests ─────────────────────────

const noteSchema = z.string().trim().min(1).max(1000);

export const inspectionItemAnswerSchema = z.object({
  checklistItemId: z.string().uuid(),
  result: z.nativeEnum(InspectionItemResult),
  note: z.string().trim().max(1000).optional(),
});

export const inspectionTireAnswerSchema = z.object({
  position: z.nativeEnum(TirePosition),
  psi: z.number().int().min(0).max(250),
  tread: z.number().int().min(0).max(32),
});

/** Who does a Job the inspection creates (Manager only). Keyed by the catalog Job the defects point to. */
export const inspectionJobAssignmentSchema = z.object({
  catalogJobId: z.string().uuid(),
  assignedMechanicId: z.string().uuid(),
});

/** D41: save the whole sheet once — every active check answered and the 10 tires. */
export const saveInspectionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  items: z.array(inspectionItemAnswerSchema).min(1).max(300),
  tires: z.array(inspectionTireAnswerSchema).length(TIRE_POSITIONS.length),
  notes: z.string().trim().max(2000).optional(),
  assignments: z.array(inspectionJobAssignmentSchema).max(100).optional(),
});
export type SaveInspectionInput = z.infer<typeof saveInspectionSchema>;

/** D41 point 6: after saving, defects can only be added (an ok / n/a check becomes a defect). */
export const addInspectionDefectsSchema = z.object({
  idempotencyKey: z.string().uuid(),
  defects: z.array(z.object({ inspectionItemId: z.string().uuid(), note: noteSchema })).min(1).max(300),
  assignments: z.array(inspectionJobAssignmentSchema).max(100).optional(),
});
export type AddInspectionDefectsInput = z.infer<typeof addInspectionDefectsSchema>;

/** D41 point 8: Setup → Inspection checklist. The array order is the order inside each section. */
export const inspectionChecklistItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  section: z.nativeEnum(InspectionSection),
  label: z.string().trim().min(1).max(120),
  catalogJobId: z.string().uuid().nullable(),
  workflowStepKey: z.literal('detailing').nullable(),
  active: z.boolean(),
}).refine((item) => (item.catalogJobId === null) !== (item.workflowStepKey === null), {
  message: 'A check creates a catalog Job or adds a note to the Detailing step',
});

export const inspectionTireLimitsSchema = z.object({
  steerTargetPsi: z.number().int().min(1).max(250),
  driveTargetPsi: z.number().int().min(1).max(250),
  steerMinTread: z.number().int().min(0).max(32),
  driveMinTread: z.number().int().min(0).max(32),
  watchPct: z.number().int().min(1).max(100),
  fixPct: z.number().int().min(2).max(100),
}).refine((limits) => limits.fixPct > limits.watchPct, { message: 'Fix must be farther from the target than Watch' });

export const saveInspectionChecklistSchema = z.object({
  items: z.array(inspectionChecklistItemInputSchema).min(1).max(300),
  limits: inspectionTireLimitsSchema,
});
export type SaveInspectionChecklistInput = z.infer<typeof saveInspectionChecklistSchema>;

// ───────────────────────── Responses ─────────────────────────

export type InspectionChecklistItemDto = {
  id: string;
  section: InspectionSection;
  label: string;
  sortOrder: number;
  active: boolean;
  /** What a defect creates: a catalog Job, or a note on the Detailing step. */
  catalogJob: { id: string; displayName: string; categoryName: string; active: boolean } | null;
  workflowStepKey: string | null;
};

export type InspectionChecklistDto = {
  items: InspectionChecklistItemDto[];
  limits: InspectionTireLimits;
  canEdit: boolean;
  /** Active catalog Jobs a check can point to (Setup's "A defect creates"). */
  catalogJobs: Array<{ id: string; displayName: string; categoryName: string }>;
};

export type InspectionItemDto = {
  id: string;
  checklistItemId: string | null;
  section: InspectionSection;
  label: string;
  result: InspectionItemResult;
  note: string | null;
  catalogJobName: string | null;
  catalogJobId: string | null;
  catalogCategoryName: string | null;
  workflowStepKey: string | null;
  addedLater: { at: string; byName: string | null } | null;
};

export type TireReadingDto = {
  position: TirePosition;
  psi: number;
  tread: number;
  targetPsi: number;
  minTread: number;
  status: TireReadingStatus;
  readAt: string;
};

export type InspectionJobLinkDto = {
  jobId: string;
  displayName: string;
  status: string;
  assignedMechanicName: string | null;
  /** The findings behind this Job (several when defects shared one Job). */
  sources: Array<{ kind: WorkOrderJobSourceKind; label: string; note: string | null; addedLater: boolean }>;
};

export type TruckInspectionDto = {
  id: string;
  inspectedAt: string;
  inspectedBy: { id: string; name: string; isMechanic: boolean };
  workOrderId: string | null;
  notes: string | null;
  items: InspectionItemDto[];
  tires: TireReadingDto[];
  jobs: InspectionJobLinkDto[];
  /** Issues found when the sheet created a Job or a note; no issues found otherwise. */
  issuesFound: boolean;
  workOrderOpen: boolean;
};

/** GET the inspection of a Truck's current visit: the list to fill, or the saved report. */
export type TruckInspectionStateDto = {
  truck: { id: string; truckNumber: string; mileage: number | null };
  /** `jobCatalogIds`: catalog Jobs already on the Work Order (not cancelled), so Review shows "adds to …". */
  workOrder: { id: string; displayId: string; status: string; jobCatalogIds: string[] } | null;
  checklist: InspectionChecklistItemDto[];
  /** The Jobs a tire to fix creates: Flat Repair (pressure) and Tires (tread). */
  tireJobs: { flatRepair: { id: string; displayName: string; categoryName: string }; tires: { id: string; displayName: string; categoryName: string } } | null;
  limits: InspectionTireLimits;
  inspection: TruckInspectionDto | null;
  /** The last reading per position from an earlier visit ("Last check Sep 12: 94 PSI · 9/32"). */
  previousTires: TireReadingDto[];
  canInspect: boolean;
  /** Manager only: pick who does each new Job. A mechanic's Jobs are born unowned. */
  canAssign: boolean;
};

/** D41 / HU-ME7: a Truck waiting for inspection, for "To inspect" in My work. */
export type InspectionQueueItemDto = {
  truckId: string;
  truckNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  workOrderId: string;
  workOrderDisplayId: string;
  waitingSince: string;
};
