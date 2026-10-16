import { z } from 'zod';
import {
  CatalogStatus,
  MechanicMode,
  JobExternalKind,
  BlockerReason,
  PauseReason,
  ShopWorkflowStepKey,
  WorkOrderNoteKind,
  Priority,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  YardBoardPhase,
  YardReadinessFilter,
  WorkOrderStatus,
  WorkPlanInspectionOutcome,
} from './enums';

export const mechanicModeSchema = z.nativeEnum(MechanicMode);

/** LTR-78 / D22. Creates an active person and applies exactly one of Standard, PM or Safety. */
export const adminCreateMechanicSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(120),
  mode: mechanicModeSchema,
});

/** LTR-78 / D22. Activate or deactivate, rename, or switch Standard/PM/Safety on an existing roster row. */
export const adminUpdateMechanicSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  mode: mechanicModeSchema.optional(),
  active: z.boolean().optional(),
  /** D41: "Can inspect trucks" — Standard and PM mechanics only (Safety keeps doing only QC). */
  canInspect: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.mode !== undefined || value.active !== undefined || value.canInspect !== undefined, {
  message: 'Provide a name, Standard/PM/Safety mode, active flag or the inspect permission',
});

/** LTR-77. Adds a job to an existing category. Does not create categories. */
export const adminCreateCatalogJobSchema = z.object({
  categoryId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(200),
  status: z.nativeEnum(CatalogStatus).optional(),
});

/** LTR-77. Rename and/or activate/deactivate a catalog job. Identity stays the same. */
export const adminUpdateCatalogJobSchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  status: z.nativeEnum(CatalogStatus).optional(),
  /** LTR-198 / D-SET4: on rename, keep the old name as an alias (default) so searches still find the Job. */
  keepOldNameAsAlias: z.boolean().optional(),
}).refine((value) => value.displayName !== undefined || value.status !== undefined, {
  message: 'Provide a display name or status',
});

/** LTR-198 / D30: the Manager creates a Category. */
export const adminCreateCatalogCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

/** LTR-198 / D30, D-SET9: rename, activate or deactivate a Category (with an optional one-line reason). */
export const adminUpdateCatalogCategorySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  status: z.nativeEnum(CatalogStatus).optional(),
  inactiveReason: z.string().trim().max(200).nullable().optional(),
}).refine((value) => value.name !== undefined || value.status !== undefined || value.inactiveReason !== undefined, {
  message: 'Provide a name, a status or a reason',
});

/** LTR-198 / D30: add an alias to a catalog Job. */
export const adminCreateCatalogAliasSchema = z.object({
  text: z.string().trim().min(1).max(200),
});

export const adminListQuerySchema = z.object({
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.string().trim().min(1).max(80).optional(),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

const commaSeparatedEnum = <T extends z.EnumLike>(values: T) =>
  z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value.split(',').map((item) => item.trim()).filter(Boolean)
        : value,
    z.array(z.nativeEnum(values)).min(1),
  );

const queryBoolean = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    return value;
  },
  z.boolean(),
);

export const adminWorkOrderCursorSchema = z.object({
  sort: z.enum(['updatedAt', 'createdAt', 'displayId']),
  direction: z.enum(['asc', 'desc']),
  value: z.string().min(1),
  id: z.string().uuid(),
});

export const adminWorkOrdersQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).max(200).optional(),
  status: commaSeparatedEnum(WorkOrderStatus).optional(),
  priority: commaSeparatedEnum(Priority).optional(),
  createdBefore: z.string().datetime({ offset: true }).optional(),
  completedFrom: z.string().datetime({ offset: true }).optional(),
  completedBefore: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['updatedAt', 'createdAt', 'displayId']).default('updatedAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export const adminMechanicCursorSchema = z.object({
  direction: z.enum(['asc', 'desc']),
  name: z.string().min(1),
  id: z.string().uuid(),
});

const adminNamedListQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).max(200).optional(),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

export const adminMechanicsQuerySchema = adminNamedListQuerySchema.extend({
  // LTR-151: assignment pickers list only people who can own a job (no System Admin accounts).
  assignable: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
  // LTR-160: deactivated accounts are hidden unless the roster asks for them.
  includeInactive: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
  /** LTR-199 / D31: People filter. Removed people show only under `removed` (or `all`). */
  status: z.enum(['active', 'inactive', 'removed', 'all']).optional(),
});

/** LTR-199 / D28, D31: send some of a person's pending queue Jobs back to their team queue. */
export const adminSendJobsToQueueSchema = z.object({
  jobIds: z.array(z.string().uuid()).max(100).optional(),
});

/**
 * D44: a truck field the Manager may leave empty. Not sent = unchanged (PATCH); empty text or null = not known.
 */
const optionalTruckText = (max: number) => z.union([z.string(), z.null()]).optional()
  .transform((value) => (value === undefined ? undefined : value?.trim() || null))
  .refine((value) => value == null || value.length <= max, { message: `At most ${max} characters` });

/** D44: model years a truck can have (1950 to next year's models). */
export function truckYearRange(now = new Date()) {
  return { min: 1950, max: now.getFullYear() + 2 };
}

const truckYearSchema = z.union([z.number().int(), z.null()]).optional().refine(
  (value) => value == null || (value >= truckYearRange().min && value <= truckYearRange().max),
  { message: 'Year must be between 1950 and two years from now' },
);

/** D44: every field on the truck's card. `mileage` is not here: the official mileage changes only at PM (D10). */
const truckFieldsShape = {
  truckNumber: z.string().trim().min(1).max(40),
  // Stored trimmed and in capitals; the duplicate check ignores spaces and dashes (normalizeVin).
  vin: optionalTruckText(40).transform((value) => (value == null ? value : value.toUpperCase())),
  make: optionalTruckText(80),
  model: optionalTruckText(80),
  year: truckYearSchema,
  licensePlate: optionalTruckText(40),
  owner: optionalTruckText(120),
  company: optionalTruckText(120),
  dispatcher: optionalTruckText(120),
  insurance: optionalTruckText(120),
};

/** D44 / HU-M18: Trucks → Add truck. Only the number is required. */
export const adminCreateTruckSchema = z.object(truckFieldsShape).strict();

/** D44: edit the card, deactivate (`active: false`) or reactivate. */
export const adminUpdateTruckSchema = z.object({
  ...truckFieldsShape,
  truckNumber: truckFieldsShape.truckNumber.optional(),
  active: z.boolean().optional(),
}).strict().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: 'Provide at least one field',
});

/** D44 §4: the fields Samsara can fill when the truck is connected. */
export const SAMSARA_CONNECT_FIELDS = ['vin', 'make', 'model', 'year', 'licensePlate'] as const;
const samsaraChoiceSchema = z.enum(['ours', 'samsara']).optional();

/** D44 §3–4: connect a Samsara vehicle; `choose` says which value stays where both sides have a different one. */
export const adminConnectSamsaraSchema = z.object({
  vehicleId: z.string().trim().min(1).max(64),
  choose: z.object({
    vin: samsaraChoiceSchema,
    make: samsaraChoiceSchema,
    model: samsaraChoiceSchema,
    year: samsaraChoiceSchema,
    licensePlate: samsaraChoiceSchema,
  }).strict().optional(),
}).strict();

const closedWorkOrderStatus = z.enum([WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED]);

export const adminHistoryQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).max(200).optional(),
  status: z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value.split(',').map((item) => item.trim()).filter(Boolean)
        : value,
    z.array(closedWorkOrderStatus).min(1),
  ).optional(),
  completedFrom: z.string().datetime({ offset: true }).optional(),
  completedBefore: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['updatedAt', 'createdAt', 'displayId']).default('updatedAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

/** D44: Trucks → Inactive shows the deactivated trucks (they are hidden by default). */
export const adminTrucksQuerySchema = adminNamedListQuerySchema.extend({
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});
export const adminTruckCursorSchema = z.object({
  direction: z.enum(['asc', 'desc']),
  truckNumber: z.string().min(1).max(120),
  id: z.string().uuid(),
});

export const adminRepairHistoryQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  excludeWorkOrderId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(25).default(5),
  cursor: z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/).optional(),
});

export const adminYardOperationsCursorSchema = z.object({
  truckNumber: z.string().min(1).max(120),
  id: z.string().uuid(),
});

export const adminYardOperationsQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).max(200).optional(),
  readiness: commaSeparatedEnum(YardReadinessFilter).optional(),
  phase: commaSeparatedEnum(YardBoardPhase).optional(),
  workOrderStatus: commaSeparatedEnum(WorkOrderStatus).optional(),
  priority: commaSeparatedEnum(Priority).optional(),
  mechanicId: z.string().uuid().optional(),
  blocked: queryBoolean.optional(),
  /** Stage 6: quick filter — a pending Job sent the whole truck to an external shop (D24). */
  outOfShop: queryBoolean.optional(),
  /**
   * Stage 8: Truck numbers Dispatch expects to leave soon (today or the next shop day). The web already has the
   * Dispatch departures; it sends them so the API can count and filter "Leaving soon" over every page.
   */
  soonTrucks: z.string().trim().max(2000).optional()
    .transform((value) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 200) : undefined)),
  /** Stage 8: quick filter "Leaving soon" (the open Trucks among `soonTrucks`). */
  soon: queryBoolean.optional(),
});

export const adminMutationMetaSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const adminAssignJobSchema = adminMutationMetaSchema.extend({
  mechanicId: z.string().uuid(),
});

export const adminUnassignJobSchema = adminMutationMetaSchema;

/** LTR-188 / D23: `POST /admin/work-orders/:id/jobs/:jobId/helper` — a helper Job for another Standard mechanic. */
export const adminAddHelperJobSchema = adminMutationMetaSchema.extend({
  mechanicId: z.string().uuid(),
});

/** LTR-188 / D24: `POST /admin/work-orders/:id/jobs/:jobId/external` — the part or the truck goes out. */
export const adminSendJobExternalSchema = adminMutationMetaSchema.extend({
  kind: z.nativeEnum(JobExternalKind),
  note: z.string().trim().min(1).max(1000),
});

/** LTR-188 / D24: `POST /admin/work-orders/:id/jobs/:jobId/external/return` — complete it or give it to a mechanic. */
export const adminReturnJobExternalSchema = adminMutationMetaSchema
  .extend({
    outcome: z.enum(['complete', 'assign']),
    mechanicId: z.string().uuid().optional(),
  })
  .refine((value) => value.outcome !== 'assign' || Boolean(value.mechanicId), {
    message: 'mechanicId is required to assign',
    path: ['mechanicId'],
  });

export const adminCancelWorkOrderSchema = adminMutationMetaSchema.extend({
  reason: z.string().trim().min(1).max(1000),
});

export const adminCompleteWorkOrderSchema = adminMutationMetaSchema;

export const adminReopenWorkOrderSchema = adminMutationMetaSchema.extend({
  reason: z.string().trim().min(1).max(1000),
});

export const adminPatchWorkOrderSchema = adminMutationMetaSchema
  .extend({
    priority: z.nativeEnum(Priority).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((value) => value.priority !== undefined || value.notes !== undefined, {
    message: 'At least one of priority or notes is required',
    path: ['priority'],
  });

export const adminTimeCorrectionSchema = adminMutationMetaSchema
  .extend({
    workOrderId: z.string().uuid(),
    targetType: z.enum(['work_session', 'pause_event']),
    targetId: z.string().uuid(),
    startedAt: z.string().datetime({ offset: true }).optional(),
    endedAt: z.string().datetime({ offset: true }).optional(),
    reason: z.string().trim().min(1).max(1000),
  })
  .refine((value) => value.startedAt !== undefined || value.endedAt !== undefined, {
    message: 'At least one of startedAt or endedAt is required',
    path: ['startedAt'],
  });

export const adminCancelJobSchema = adminMutationMetaSchema.extend({
  reason: z.string().trim().min(1).max(1000),
});

export const adminCompleteJobSchema = adminMutationMetaSchema.extend({
  notes: z.string().trim().max(2000).optional(),
  /** LTR-216: completing a Quality Check that Safety returned needs this and a note. */
  overrideSafetyReturn: z.boolean().optional(),
});

/** LTR-148: the PM mechanic switches their PM job between PM Category catalog jobs. */
export const changePmServiceSchema = z.object({
  catalogJobId: z.string().uuid(),
});

/** LTR-145: switch the Work Order's PM job between PM Category catalog jobs (PM A ↔ PM B). */
export const adminChangePmServiceSchema = adminMutationMetaSchema.extend({
  catalogJobId: z.string().uuid(),
});

export const adminReopenJobSchema = adminMutationMetaSchema.extend({
  reason: z.string().trim().min(1).max(1000),
});

// LTR-158: the reason is optional; the common case needs no text.
export const adminReturnToServiceSchema = adminMutationMetaSchema.extend({
  reason: z.string().trim().max(1000).optional(),
});

export const startReadinessAssessmentSchema = z.object({
  idempotencyKey: z.string().uuid(),
});

export const updateReadinessRequirementSchema = z.object({
  type: z.nativeEnum(ReadinessRequirementType),
  outcome: z.nativeEnum(ReadinessRequirementOutcome),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
  waiverReason: z.string().trim().min(1).max(1000).optional(),
  evidenceWorkOrderId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  if (value.outcome === ReadinessRequirementOutcome.WAIVED && !value.waiverReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['waiverReason'],
      message: 'A waiver reason is required',
    });
  }
  if (value.outcome !== ReadinessRequirementOutcome.WAIVED && value.waiverReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['waiverReason'],
      message: 'Waiver reason is only valid for waived requirements',
    });
  }
});

export const createWorkOrderJobSchema = z.object({
  catalogJobId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  displayName: z.string().min(1).max(200),
  customDescription: z.string().min(1).max(500).optional(),
  // Manager-first ownership: optional per-Job assignee at create time.
  assignedMechanicId: z.string().uuid().optional(),
});

export const createWorkOrderSchema = z.object({
  truckId: z.string().uuid(),
  // LTR-157 / D13: optional for the Manager (derived); "Create PM service" still sends the PM Category.
  primaryCategoryId: z.string().uuid().optional(),
  priority: z.nativeEnum(Priority).default(Priority.NORMAL),
  notes: z.string().max(2000).optional(),
  mechanicIds: z.array(z.string().uuid()).default([]),
  // The service validates category-specific job requirements: standard Work
  // Orders need jobs, while PM is a standalone service with no checklist.
  jobs: z.array(createWorkOrderJobSchema).default([]),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const pauseWorkOrderSchema = z.object({
  reason: z.nativeEnum(PauseReason),
  notes: z.string().max(1000).optional(),
});

// Manager-first ownership: a mechanic reports a blocker without pausing the
// Work Order. The Manager pauses/resumes officially.
// LTR-155 / D17: a blocker always belongs to one of the mechanic's Jobs and uses
// the mechanic reasons only (no Break, End of Shift, Working on Another WO,
// Truck Unavailable — those stay on PauseReason for the Manager).
export const reportBlockerSchema = z.object({
  jobId: z.string().uuid(),
  reason: z.nativeEnum(BlockerReason),
  notes: z.string().max(1000).optional(),
});

/** LTR-155 / D17: the mechanic appends notes to an active blocker ("the part arrived"). */
export const addBlockerNoteSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

/** LTR-155 / D17: only the Manager resolves, with an optional note. */
export const resolveBlockerSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
}).default({});

export const adminPauseWorkOrderSchema = z.object({
  reason: z.nativeEnum(PauseReason),
  notes: z.string().max(1000).optional(),
});

export const updateWorkOrderNotesSchema = z.object({
  notes: z.string().max(2000).optional(),
});

/** LTR-126 / D8: append one note or work request to a Work Order. */
export const addWorkOrderNoteSchema = z.object({
  kind: z.nativeEnum(WorkOrderNoteKind).default(WorkOrderNoteKind.NOTE),
  body: z.string().trim().min(1).max(2000),
});

export const completeJobSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
});

export const updatePmServiceSchema = z.object({
  observedMileage: z.number().int().nonnegative().nullable(),
  // LTR-135: required when the jump over the truck mileage exceeds the threshold.
  confirmLargeMileageJump: z.boolean().optional(),
  selections: z.array(z.object({
    partCategoryId: z.string().uuid(),
    partId: z.string().uuid(),
  })).max(9),
}).refine((value) => new Set(value.selections.map((selection) => selection.partCategoryId)).size === value.selections.length, {
  message: 'Only one part can be selected per category',
  path: ['selections'],
});

export const addJobSchema = z.object({
  catalogJobId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  displayName: z.string().min(1).max(200),
  customDescription: z.string().min(1).max(500).optional(),
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
});

export const addWorkPlanJobsSchema = z.object({
  idempotencyKey: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative().optional(),
  jobs: z.array(createWorkOrderJobSchema.extend({
    // D42 / S-6: the Samsara faults this Job takes care of (recommended in Add work).
    samsaraFaultIds: z.array(z.string().uuid()).min(1).max(20).optional(),
    // D46 / SQ-3: the Safety findings this Job takes care of.
    qcFindingIds: z.array(z.string().uuid()).min(1).max(20).optional(),
  })).min(1).max(50),
});

/** D42 / S-6: tie active Samsara faults to a Job already on the open Work Order (no second Job). */
export const linkTruckFaultsSchema = z.object({
  workOrderJobId: z.string().uuid(),
  faultIds: z.array(z.string().uuid()).min(1).max(20),
});
export type LinkTruckFaultsInput = z.infer<typeof linkTruckFaultsSchema>;

/** D42 / S-6: "not now" on a recommended fault, with the reason. */
export const dismissTruckFaultSchema = z.object({
  reason: z.string().trim().min(1).max(300),
});
export type DismissTruckFaultInput = z.infer<typeof dismissTruckFaultSchema>;

export const recordWorkPlanInspectionSchema = z.object({
  outcome: z.enum([
    WorkPlanInspectionOutcome.ISSUES_FOUND,
    WorkPlanInspectionOutcome.NO_ISSUES_FOUND,
  ]),
  idempotencyKey: z.string().uuid(),
});

export const searchTrucksSchema = z.object({
  q: z.string().min(1).max(50),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type PauseWorkOrderInput = z.infer<typeof pauseWorkOrderSchema>;
export type UpdateWorkOrderNotesInput = z.infer<typeof updateWorkOrderNotesSchema>;
export type AddWorkOrderNoteInput = z.infer<typeof addWorkOrderNoteSchema>;
export type CompleteJobInput = z.infer<typeof completeJobSchema>;
export type AddJobInput = z.infer<typeof addJobSchema>;
export type UpdatePmServiceInput = z.infer<typeof updatePmServiceSchema>;
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type AdminWorkOrdersQuery = z.infer<typeof adminWorkOrdersQuerySchema>;
export type AdminWorkOrderCursor = z.infer<typeof adminWorkOrderCursorSchema>;
export type AdminMechanicsQuery = z.infer<typeof adminMechanicsQuerySchema>;
export type AdminMechanicCursor = z.infer<typeof adminMechanicCursorSchema>;
export type AdminHistoryQuery = z.infer<typeof adminHistoryQuerySchema>;
export type AdminTrucksQuery = z.infer<typeof adminTrucksQuerySchema>;
export type AdminCreateTruckInput = z.input<typeof adminCreateTruckSchema>;
export type AdminUpdateTruckInput = z.input<typeof adminUpdateTruckSchema>;
export type AdminConnectSamsaraInput = z.infer<typeof adminConnectSamsaraSchema>;
export type SamsaraConnectField = (typeof SAMSARA_CONNECT_FIELDS)[number];
export type AdminTruckCursor = z.infer<typeof adminTruckCursorSchema>;
export type AdminRepairHistoryQuery = z.infer<typeof adminRepairHistoryQuerySchema>;
export type AdminYardOperationsQuery = z.infer<typeof adminYardOperationsQuerySchema>;
export type AdminYardOperationsCursor = z.infer<typeof adminYardOperationsCursorSchema>;
export type AdminMutationMetaInput = z.infer<typeof adminMutationMetaSchema>;
export type AdminCancelWorkOrderInput = z.infer<typeof adminCancelWorkOrderSchema>;
export type AdminCompleteWorkOrderInput = z.infer<typeof adminCompleteWorkOrderSchema>;
export type AdminReopenWorkOrderInput = z.infer<typeof adminReopenWorkOrderSchema>;
export type AdminPatchWorkOrderInput = z.infer<typeof adminPatchWorkOrderSchema>;
export type AdminTimeCorrectionInput = z.infer<typeof adminTimeCorrectionSchema>;
export type AdminCancelJobInput = z.infer<typeof adminCancelJobSchema>;
export type AdminCompleteJobInput = z.infer<typeof adminCompleteJobSchema>;
export type AdminReopenJobInput = z.infer<typeof adminReopenJobSchema>;
export type AdminReturnToServiceInput = z.infer<typeof adminReturnToServiceSchema>;
export type StartReadinessAssessmentInput = z.infer<typeof startReadinessAssessmentSchema>;
export type UpdateReadinessRequirementInput = z.infer<typeof updateReadinessRequirementSchema>;
export type AddWorkPlanJobsInput = z.infer<typeof addWorkPlanJobsSchema>;
export type RecordWorkPlanInspectionInput = z.infer<typeof recordWorkPlanInspectionSchema>;
export type AdminCreateMechanicInput = z.infer<typeof adminCreateMechanicSchema>;
export type AdminUpdateMechanicInput = z.infer<typeof adminUpdateMechanicSchema>;
export type AdminCreateCatalogJobInput = z.infer<typeof adminCreateCatalogJobSchema>;
export type AdminUpdateCatalogJobInput = z.infer<typeof adminUpdateCatalogJobSchema>;

/**
 * LTR-157 / D15, D16: the Manager (or System Admin) sets the default owner of
 * each mandatory step. Quality Check never has one (D15).
 */
/**
 * LTR-197 / D28: each step's team (`memberIds`). `defaultMechanicId` is the pre-team shape (one owner) and is read
 * as a team of one — or an empty team when null.
 */
export const updateShopWorkflowStepsSchema = z.object({
  steps: z.array(z.object({
    stepKey: z.nativeEnum(ShopWorkflowStepKey),
    memberIds: z.array(z.string().uuid()).max(50).optional(),
    defaultMechanicId: z.string().uuid().nullable().optional(),
  }).refine((step) => step.memberIds !== undefined || step.defaultMechanicId !== undefined, {
    message: 'Send memberIds for each step.',
  })).min(1),
});

/** D46 / SQ-3: add a Safety finding to a Job already on the Work Order. */
export const qcFindingAddToJobSchema = z.object({ jobId: z.string().uuid() });
/** D46 / SQ-3: set a Safety finding aside, saying why. */
export const qcFindingDismissSchema = z.object({ reason: z.string().trim().min(1).max(300) });
