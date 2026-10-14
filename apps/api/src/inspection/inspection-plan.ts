import { WorkOrderJobSourceKind } from '@ltl-shop/shared';

/**
 * D41 point 3: what the saved findings do to the Work Order — pure, so the rules are tested apart from the database.
 *
 * - Defects that point to the same catalog Job become **one** Job (A24: the catalog does not repeat a Job).
 * - If that Job is already on the Work Order (not cancelled), the finding is added to it; no second Job.
 * - A check that points to the Detailing step adds its finding to the Detailing Job the Work Order already has.
 * - A tire in "fix" creates Flat Repair (pressure) or Tires (tread), with the same merge rules.
 */
export type PlanSource =
  | { kind: WorkOrderJobSourceKind.INSPECTION_ITEM; inspectionItemId: string; note: string }
  | { kind: WorkOrderJobSourceKind.TIRE_READING; tireReadingId: string; note: string };

export type PlanFinding = {
  /** The catalog Job a defect creates, or null when it goes to a step. */
  catalogJobId: string | null;
  workflowStepKey: string | null;
  source: PlanSource;
};

export type PlanWorkOrderJob = {
  id: string;
  catalogJobId: string | null;
  status: string;
  helperOfJobId: string | null;
  isDetailing: boolean;
};

export type InspectionPlan = {
  /** New Jobs to create, one per catalog Job, with every finding behind it. */
  create: Array<{ catalogJobId: string; sources: PlanSource[] }>;
  /** Findings added to Jobs the Work Order already has. */
  attach: Array<{ jobId: string; sources: PlanSource[] }>;
};

export function planInspectionFindings(findings: PlanFinding[], jobs: PlanWorkOrderJob[]): InspectionPlan {
  const live = jobs.filter((job) => job.status !== 'cancelled' && !job.helperOfJobId);
  const byCatalog = new Map(live.filter((job) => job.catalogJobId).map((job) => [job.catalogJobId as string, job.id]));
  const detailing = live.find((job) => job.isDetailing) ?? null;

  const create = new Map<string, PlanSource[]>();
  const attach = new Map<string, PlanSource[]>();
  const push = (map: Map<string, PlanSource[]>, key: string, source: PlanSource) => {
    const list = map.get(key);
    if (list) list.push(source);
    else map.set(key, [source]);
  };

  for (const finding of findings) {
    if (finding.workflowStepKey) {
      if (!detailing) throw new InspectionPlanError('DETAILING_STEP_MISSING');
      push(attach, detailing.id, finding.source);
      continue;
    }
    if (!finding.catalogJobId) throw new InspectionPlanError('CHECK_WITHOUT_TARGET');
    const existing = byCatalog.get(finding.catalogJobId);
    if (existing) push(attach, existing, finding.source);
    else push(create, finding.catalogJobId, finding.source);
  }

  return {
    create: [...create].map(([catalogJobId, sources]) => ({ catalogJobId, sources })),
    attach: [...attach].map(([jobId, sources]) => ({ jobId, sources })),
  };
}

export class InspectionPlanError extends Error {
  constructor(readonly code: 'DETAILING_STEP_MISSING' | 'CHECK_WITHOUT_TARGET') {
    super(code);
  }
}
