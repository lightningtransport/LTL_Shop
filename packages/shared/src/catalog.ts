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
