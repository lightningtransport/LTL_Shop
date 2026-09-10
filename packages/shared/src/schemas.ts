import { z } from 'zod';
import {
  MechanicMode,
  PauseReason,
  Priority,
  ReadinessRequirementOutcome,
  ReadinessRequirementType,
  ReadinessPhase,
  YardReadinessFilter,
  WorkOrderStatus,
} from './enums';

export const mechanicModeSchema = z.nativeEnum(MechanicMode);

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

export const adminMechanicsQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).max(200).optional(),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

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

export const adminTrucksQuerySchema = adminMechanicsQuerySchema;
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
  phase: commaSeparatedEnum(ReadinessPhase).optional(),
  workOrderStatus: commaSeparatedEnum(WorkOrderStatus).optional(),
  priority: commaSeparatedEnum(Priority).optional(),
  mechanicId: z.string().uuid().optional(),
  blocked: queryBoolean.optional(),
});

export const adminMutationMetaSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const adminAddWorkOrderMechanicSchema = adminMutationMetaSchema.extend({
  mechanicId: z.string().uuid(),
});

export const adminRemoveWorkOrderMechanicSchema = adminMutationMetaSchema;

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

export const adminReopenJobSchema = adminMutationMetaSchema.extend({
  reason: z.string().trim().min(1).max(1000),
});

export const adminReturnToServiceSchema = adminMutationMetaSchema.extend({
  reason: z.string().trim().min(1).max(1000),
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

export const markReadinessReadySchema = adminMutationMetaSchema;

export const closeReadinessAssessmentSchema = adminMutationMetaSchema.extend({
  reason: z.string().trim().min(1).max(1000),
});

export const createWorkOrderJobSchema = z.object({
  catalogJobId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  displayName: z.string().min(1).max(200),
  customDescription: z.string().min(1).max(500).optional(),
});

export const createWorkOrderSchema = z.object({
  truckId: z.string().uuid(),
  primaryCategoryId: z.string().uuid(),
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

export const changePauseReasonSchema = z.object({
  reason: z.nativeEnum(PauseReason),
  notes: z.string().max(1000).optional(),
});

export const updateWorkOrderNotesSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const updatePmServiceSchema = z.object({
  observedMileage: z.number().int().nonnegative().nullable(),
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

export const searchTrucksSchema = z.object({
  q: z.string().min(1).max(50),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type PauseWorkOrderInput = z.infer<typeof pauseWorkOrderSchema>;
export type ChangePauseReasonInput = z.infer<typeof changePauseReasonSchema>;
export type UpdateWorkOrderNotesInput = z.infer<typeof updateWorkOrderNotesSchema>;
export type AddJobInput = z.infer<typeof addJobSchema>;
export type UpdatePmServiceInput = z.infer<typeof updatePmServiceSchema>;
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;
export type AdminWorkOrdersQuery = z.infer<typeof adminWorkOrdersQuerySchema>;
export type AdminWorkOrderCursor = z.infer<typeof adminWorkOrderCursorSchema>;
export type AdminMechanicsQuery = z.infer<typeof adminMechanicsQuerySchema>;
export type AdminMechanicCursor = z.infer<typeof adminMechanicCursorSchema>;
export type AdminHistoryQuery = z.infer<typeof adminHistoryQuerySchema>;
export type AdminTrucksQuery = z.infer<typeof adminTrucksQuerySchema>;
export type AdminTruckCursor = z.infer<typeof adminTruckCursorSchema>;
export type AdminRepairHistoryQuery = z.infer<typeof adminRepairHistoryQuerySchema>;
export type AdminYardOperationsQuery = z.infer<typeof adminYardOperationsQuerySchema>;
export type AdminYardOperationsCursor = z.infer<typeof adminYardOperationsCursorSchema>;
export type AdminMutationMetaInput = z.infer<typeof adminMutationMetaSchema>;
export type AdminAddWorkOrderMechanicInput = z.infer<typeof adminAddWorkOrderMechanicSchema>;
export type AdminRemoveWorkOrderMechanicInput = z.infer<typeof adminRemoveWorkOrderMechanicSchema>;
export type AdminCancelWorkOrderInput = z.infer<typeof adminCancelWorkOrderSchema>;
export type AdminCompleteWorkOrderInput = z.infer<typeof adminCompleteWorkOrderSchema>;
export type AdminReopenWorkOrderInput = z.infer<typeof adminReopenWorkOrderSchema>;
export type AdminPatchWorkOrderInput = z.infer<typeof adminPatchWorkOrderSchema>;
export type AdminTimeCorrectionInput = z.infer<typeof adminTimeCorrectionSchema>;
export type AdminCancelJobInput = z.infer<typeof adminCancelJobSchema>;
export type AdminReopenJobInput = z.infer<typeof adminReopenJobSchema>;
export type AdminReturnToServiceInput = z.infer<typeof adminReturnToServiceSchema>;
export type StartReadinessAssessmentInput = z.infer<typeof startReadinessAssessmentSchema>;
export type UpdateReadinessRequirementInput = z.infer<typeof updateReadinessRequirementSchema>;
export type MarkReadinessReadyInput = z.infer<typeof markReadinessReadySchema>;
export type CloseReadinessAssessmentInput = z.infer<typeof closeReadinessAssessmentSchema>;
