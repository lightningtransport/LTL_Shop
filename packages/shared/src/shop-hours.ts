import { z } from 'zod';

/**
 * LTR-186 / D20: shop hours. The day close runs at `cutoff` (shop time, America/New_York) on each
 * workday (ISO weekday, Monday = 1 … Sunday = 7). The Manager edits them in Setup → Shop workflow.
 */
export const DEFAULT_DAY_CLOSE_MINUTES = 17 * 60;
export const DEFAULT_WORKDAYS: readonly number[] = [1, 2, 3, 4, 5];
/** The earliest cutoff the Manager can set (12:00), so a typo cannot close the morning's work. */
export const MIN_DAY_CLOSE_MINUTES = 12 * 60;

const CUTOFF_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "17:00" → 1020. Returns null when the text is not a 24-hour HH:MM time. */
export function cutoffToMinutes(cutoff: string): number | null {
  const match = CUTOFF_PATTERN.exec(cutoff);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 1020 → "17:00". */
export function minutesToCutoff(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export const updateShopHoursSchema = z.object({
  cutoff: z.string().refine((value) => {
    const minutes = cutoffToMinutes(value);
    return minutes !== null && minutes >= MIN_DAY_CLOSE_MINUTES;
  }, { message: 'The day close is a time between 12:00 and 23:59.' }),
  workdays: z.array(z.number().int().min(1).max(7)).min(1).max(7)
    .refine((days) => new Set(days).size === days.length, { message: 'Each day can be listed once.' }),
});

export type UpdateShopHoursInput = z.infer<typeof updateShopHoursSchema>;
