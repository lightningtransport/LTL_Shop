/**
 * LTR-101 (JTBD-5): a Yard board card says what is missing and who is on it,
 * not only the phase badge.
 */
export type YardCardNextKey =
  | 'yardCardNextInspection'
  | 'yardCardJobsPending'
  | 'yardCardNextPm'
  | 'yardCardNextAlignment'
  | 'yardCardNextDetailing'
  | 'yardCardNextQc'
  | 'yardCardWaitingClose';

export function yardCardNextStep(input: {
  readyReason?: string;
  jobsCompleted?: number;
  jobsTotal?: number;
  /** Shop Work Jobs still to do, from the Work Plan (preferred over total − completed). */
  shopWorkRemainingCount?: number;
}): { key: YardCardNextKey; values: Record<string, string> } | null {
  switch (input.readyReason) {
    case 'inspection_pending':
      return { key: 'yardCardNextInspection', values: {} };
    case 'jobs_remaining': {
      const pending = input.shopWorkRemainingCount ?? Math.max(0, (input.jobsTotal ?? 0) - (input.jobsCompleted ?? 0));
      return { key: 'yardCardJobsPending', values: { count: String(pending) } };
    }
    case 'pm_pending':
      return { key: 'yardCardNextPm', values: {} };
    case 'alignment_pending':
      return { key: 'yardCardNextAlignment', values: {} };
    case 'detailing_pending':
      return { key: 'yardCardNextDetailing', values: {} };
    case 'qc_pending':
      return { key: 'yardCardNextQc', values: {} };
    case 'work_order_open':
      return { key: 'yardCardWaitingClose', values: {} };
    default:
      return null;
  }
}

/** Work Order age for a compact card: "5h" or "3d". */
export function compactAge(fromIso: string, now = Date.now()) {
  const hours = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 3_600_000));
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/** LTR-103: group reported work locations so 50+ rows read as a few lines. */
export function groupWorkLocations(items: { truckNumber: string; location: string | null }[], unknownLabel: string) {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const key = item.location?.trim() || unknownLabel;
    groups.set(key, [...(groups.get(key) ?? []), item.truckNumber]);
  }
  return [...groups.entries()]
    .map(([location, trucks]) => ({ location, trucks }))
    .sort((left, right) => right.trucks.length - left.trucks.length || left.location.localeCompare(right.location));
}

export function matchesTruckSearch(truckNumber: string, search: string) {
  const term = search.trim().toLowerCase();
  return !term || truckNumber.toLowerCase().includes(term);
}

export function fillYardText(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
