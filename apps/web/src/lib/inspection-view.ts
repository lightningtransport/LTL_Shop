import {
  InspectionItemResult,
  TIRE_POSITIONS,
  TireReadingStatus,
  tireReadingStatus,
  tireTargets,
  type InspectionChecklistItemDto,
  type InspectionTireLimits,
  type TirePosition,
  type TruckInspectionStateDto,
} from '@ltl-shop/shared';

/**
 * D41: what the sheet shows before saving — the same rules the API applies (inspection-plan.ts), so Review says
 * exactly which Jobs will be created: defects that point to one catalog Job are one Job, a Job already on the
 * Work Order only gets the note, cleaning goes to Detailing, and a tire to fix creates Flat Repair or Tires.
 */
export type Answer = { result: InspectionItemResult; note: string };
export type TireAnswer = { psi: number | null; tread: number | null };
export type SheetDraft = {
  answers: Record<string, Answer>;
  tires: Partial<Record<TirePosition, TireAnswer>>;
  notes: string;
};

export const EMPTY_DRAFT: SheetDraft = { answers: {}, tires: {}, notes: '' };

export function tireStatusOf(position: TirePosition, tire: TireAnswer | undefined, limits: InspectionTireLimits) {
  if (!tire || tire.psi === null || tire.tread === null) return null;
  return tireReadingStatus({ psi: tire.psi, tread: tire.tread }, tireTargets(position, limits), limits);
}

export function sheetProgress(checklist: InspectionChecklistItemDto[], draft: SheetDraft) {
  const answered = checklist.filter((item) => draft.answers[item.id]?.result).length;
  const defects = checklist.filter((item) => draft.answers[item.id]?.result === InspectionItemResult.DEFECT);
  const missingNotes = defects.filter((item) => !draft.answers[item.id]?.note.trim()).length;
  const tires = TIRE_POSITIONS.filter((position) => {
    const tire = draft.tires[position];
    return tire && tire.psi !== null && tire.tread !== null;
  }).length;
  return {
    answered,
    total: checklist.length,
    defects: defects.length,
    missingNotes,
    tires,
    complete: answered === checklist.length && tires === TIRE_POSITIONS.length && missingNotes === 0,
  };
}

export type PreviewFinding = { label: string; note: string; tire?: boolean };
export type PreviewJob = { key: string; displayName: string; categoryName: string; catalogJobId: string; existing: boolean; findings: PreviewFinding[] };

export function previewInspection(state: TruckInspectionStateDto, draft: SheetDraft, onlyItemIds?: ReadonlySet<string>) {
  const jobs = new Map<string, PreviewJob>();
  const stepNotes: PreviewFinding[] = [];
  const watch: Array<{ position: TirePosition; psi: number; tread: number }> = [];
  const existing = new Set(state.workOrder?.jobCatalogIds ?? []);
  const add = (catalogJobId: string, displayName: string, categoryName: string, finding: PreviewFinding) => {
    const job = jobs.get(catalogJobId) ?? { key: catalogJobId, displayName, categoryName, catalogJobId, existing: existing.has(catalogJobId), findings: [] };
    job.findings.push(finding);
    jobs.set(catalogJobId, job);
  };

  for (const item of state.checklist) {
    if (onlyItemIds && !onlyItemIds.has(item.id)) continue;
    const answer = draft.answers[item.id];
    if (answer?.result !== InspectionItemResult.DEFECT) continue;
    const finding = { label: item.label, note: answer.note.trim() };
    if (item.workflowStepKey) stepNotes.push(finding);
    else if (item.catalogJob) add(item.catalogJob.id, item.catalogJob.displayName, item.catalogJob.categoryName, finding);
  }
  if (!onlyItemIds) {
    for (const position of TIRE_POSITIONS) {
      const tire = draft.tires[position];
      const status = tireStatusOf(position, tire, state.limits);
      if (!status || !tire || tire.psi === null || tire.tread === null) continue;
      if (status.status === TireReadingStatus.WATCH) watch.push({ position, psi: tire.psi, tread: tire.tread });
      if (status.status !== TireReadingStatus.FIX || !state.tireJobs) continue;
      const target = tireTargets(position, state.limits);
      const job = status.reason === 'tread' ? state.tireJobs.tires : state.tireJobs.flatRepair;
      add(job.id, job.displayName, job.categoryName, { label: `Tire ${position}`, note: `${tire.psi} PSI (target ${target.targetPsi}) · tread ${tire.tread}/32`, tire: true });
    }
  }
  const all = [...jobs.values()];
  return {
    newJobs: all.filter((job) => !job.existing),
    addsToExisting: all.filter((job) => job.existing),
    stepNotes,
    watch,
    issues: all.length > 0 || stepNotes.length > 0,
  };
}

/** The draft kept on this device until the sheet is saved (one per Truck and Work Order). */
export function inspectionDraftKey(truckId: string, workOrderId: string | null | undefined) {
  return `ltl-draft:inspection:${truckId}:${workOrderId ?? 'none'}`;
}

export function parseDraft(raw: string): SheetDraft {
  if (!raw) return EMPTY_DRAFT;
  try {
    const value = JSON.parse(raw) as Partial<SheetDraft>;
    return { answers: value.answers ?? {}, tires: value.tires ?? {}, notes: value.notes ?? '' };
  } catch {
    return EMPTY_DRAFT;
  }
}
