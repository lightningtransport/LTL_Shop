import { z } from 'zod';
import { WorkPlanJobLane } from './enums';

/**
 * LTR-198 / JC5: one way to compare catalog names and aliases — lowercase, accents removed ("líneas" = "lineas"),
 * only letters and digits kept. `job_aliases.alias_norm` stores this; the migration recomputed it with the same rule.
 */
export function normalizeCatalogText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** LTR-198 / D30: the System Jobs. Found by this key, never by name; they cannot be deactivated or deleted. */
export enum CatalogSystemKey {
  PM_A = 'pm_a',
  PM_B = 'pm_b',
  ALIGNMENT = 'alignment',
  DETAILING = 'detailing',
  QUALITY_CHECK = 'quality_check',
}

/** LTR-198 / D30: the System Categories (locked: no rename, deactivate or delete — the app reads "PM" by name). */
export enum CatalogCategorySystemKey {
  PM = 'pm',
  DETAILING = 'detailing',
  QUALITY_CHECK = 'quality_check',
}

/** SW5: the Work Plan lane of a System Job, whatever its name is now. */
export function laneForSystemKey(systemKey: string | null | undefined): WorkPlanJobLane | null {
  switch (systemKey) {
    case CatalogSystemKey.PM_A:
    case CatalogSystemKey.PM_B:
      return WorkPlanJobLane.PM;
    case CatalogSystemKey.ALIGNMENT: return WorkPlanJobLane.ALIGNMENT;
    case CatalogSystemKey.DETAILING: return WorkPlanJobLane.DETAILING;
    case CatalogSystemKey.QUALITY_CHECK: return WorkPlanJobLane.QUALITY_CHECK;
    default: return null;
  }
}

// ── LTR-57: the Custom Jobs review inbox ─────────────────────────────────────────────────────────────────────

/** `pending_review` is how a Custom Job is born; the inbox moves a whole group to one of the others. */
export type CustomJobReviewStatus = 'pending_review' | 'mapped' | 'added' | 'kept';

/** A group = the Custom Jobs of one category with the same name, ignoring capitals, accents and spaces. */
export const adminCustomJobGroupSchema = z.object({
  categoryId: z.string().uuid(),
  nameNorm: z.string().min(1).max(200),
});

export const adminReviewCustomJobsSchema = adminCustomJobGroupSchema.extend({
  action: z.enum(['map', 'add', 'keep']),
  /** `map`: the catalog Job the group is. */
  catalogJobId: z.string().uuid().optional(),
  /** `add`: the catalog name (defaults to the group's most used name). */
  displayName: z.string().trim().min(1).max(120).optional(),
  /** `map`: keep the group's name as an alias of the catalog Job (default yes). */
  addAlias: z.boolean().default(true),
}).refine((value) => value.action !== 'map' || Boolean(value.catalogJobId), { message: 'Pick the catalog Job', path: ['catalogJobId'] });

export const adminCustomJobsQuerySchema = z.object({
  status: z.enum(['pending', 'reviewed']).default('pending'),
});

export type AdminReviewCustomJobsInput = z.input<typeof adminReviewCustomJobsSchema>;

export interface AdminCustomJobGroupDto {
  categoryId: string;
  categoryName: string;
  nameNorm: string;
  /** The name used most often in the group. */
  displayName: string;
  /** Other spellings seen ("fix mirror  bracket"). */
  otherNames: string[];
  count: number;
  lastAddedAt: string;
  /** Up to 5, newest first. */
  workOrders: Array<{ id: string; displayId: string; truckNumber: string }>;
  /** Up to 3 notes written on the Jobs. */
  descriptions: string[];
  status: CustomJobReviewStatus;
  /** Reviewed groups: the catalog Job they were tied to (map or add). */
  mappedTo: { id: string; displayName: string } | null;
  /** Pending groups: catalog Jobs with a similar name or alias, best first. */
  suggestions: Array<{ catalogJobId: string; displayName: string; categoryName: string; matchedAlias: string | null }>;
}
