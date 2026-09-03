import { z } from 'zod';
import { PauseReason, Priority } from './enums';

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
