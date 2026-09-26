import { formatVehicleYmm } from './format';

/**
 * LTR-130: mechanic cards and the detail header identify the Truck
 * ("Truck 907 · 2026 Volvo VNL 860") instead of "#907", and describe the work by
 * the Job categories rather than the legacy primary category.
 */
export function vehicleLine(vehicle?: { year?: number | null; make?: string | null; model?: string | null } | null) {
  return vehicle ? formatVehicleYmm(vehicle) : '';
}

export function jobCategoriesLine(jobs: { status: string; category?: { name: string } | null }[]) {
  const names: string[] = [];
  for (const job of jobs) {
    if (job.status === 'cancelled' || !job.category?.name) continue;
    if (!names.includes(job.category.name)) names.push(job.category.name);
  }
  return names.join(', ');
}

/** Live labor: API totals at fetch time plus the time since, while a session is open. */
export function liveLaborMs(totalActiveLaborMs: number, laborRunning: boolean, fetchedAt: number, now: number) {
  return totalActiveLaborMs + (laborRunning ? Math.max(0, now - fetchedAt) : 0);
}
