import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INSPECTION_TIRE_LIMITS,
  InspectionItemResult,
  InspectionSection,
  TIRE_POSITIONS,
  type InspectionChecklistItemDto,
  type TruckInspectionStateDto,
} from '@ltl-shop/shared';
import { parseDraft, previewInspection, sheetProgress, type SheetDraft } from './inspection-view';

const check = (id: string, label: string, job: string | null, step: string | null = null): InspectionChecklistItemDto => ({
  id,
  section: InspectionSection.EXTERIOR,
  label,
  sortOrder: 10,
  active: true,
  catalogJob: job ? { id: `cat-${job}`, displayName: job, categoryName: 'Cat', active: true } : null,
  workflowStepKey: step,
});

const state = (jobCatalogIds: string[] = []): TruckInspectionStateDto => ({
  truck: { id: 't', truckNumber: '601', mileage: 1 },
  workOrder: { id: 'wo', displayId: 'WO-1', status: 'created', jobCatalogIds },
  checklist: [check('fog', 'Fog lamps', 'Lights'), check('brake', 'Brake lights', 'Lights'), check('brakes', 'Brakes', 'Brake Inspection'), check('clean', 'Interior clean', null, 'detailing')],
  tireJobs: {
    flatRepair: { id: 'cat-flat', displayName: 'Flat Repair', categoryName: 'Tires & Wheels' },
    tires: { id: 'cat-tires', displayName: 'Tires', categoryName: 'Tires & Wheels' },
  },
  limits: DEFAULT_INSPECTION_TIRE_LIMITS,
  inspection: null,
  previousTires: [],
  canInspect: true,
  canAssign: true,
});

const allTires = (over: Record<string, [number, number]> = {}) => Object.fromEntries(TIRE_POSITIONS.map((position) => {
  const [psi, tread] = over[position] ?? [position === 'LF' || position === 'RF' ? 110 : 95, 9];
  return [position, { psi, tread }];
}));

const draft = (answers: SheetDraft['answers'], tires = allTires()): SheetDraft => ({ answers, tires, notes: '' });
const ok = { result: InspectionItemResult.OK, note: '' };
const defect = (note: string) => ({ result: InspectionItemResult.DEFECT, note });

describe('D41 sheet preview (same rules as the API)', () => {
  it('counts what is left and is complete only with every check, every tire and every note', () => {
    expect(sheetProgress(state().checklist, draft({ fog: ok }, {})).complete).toBe(false);
    const missingNote = sheetProgress(state().checklist, draft({ fog: defect(''), brake: ok, brakes: ok, clean: ok }));
    expect(missingNote).toMatchObject({ answered: 4, missingNotes: 1, tires: 10, complete: false });
    expect(sheetProgress(state().checklist, draft({ fog: ok, brake: ok, brakes: ok, clean: ok })).complete).toBe(true);
  });

  it('puts two defects of the same Job in one Job, cleaning on Detailing, and a low tire on Flat Repair', () => {
    const preview = previewInspection(state(), draft({ fog: defect('lens'), brake: defect('bulb'), brakes: ok, clean: defect('mud') }, allTires({ LFO: [72, 8], LRO: [92, 3] })));
    expect(preview.newJobs.map((job) => [job.displayName, job.findings.length])).toEqual([['Lights', 2], ['Flat Repair', 1]]);
    expect(preview.stepNotes.map((note) => note.label)).toEqual(['Interior clean']);
    expect(preview.watch.map((tire) => tire.position)).toEqual(['LRO']);
    expect(preview.issues).toBe(true);
  });

  it('says a Job already on the Work Order only gets the note', () => {
    const preview = previewInspection(state(['cat-Lights']), draft({ fog: defect('lens'), brake: ok, brakes: ok, clean: ok }));
    expect(preview.newJobs).toEqual([]);
    expect(preview.addsToExisting.map((job) => job.displayName)).toEqual(['Lights']);
  });

  it('with Add defects, only looks at the new ones and leaves the tires as recorded', () => {
    const preview = previewInspection(state(), draft({ fog: defect('lens'), brakes: defect('pads') }, allTires({ LFO: [60, 1] })), new Set(['brakes']));
    expect(preview.newJobs.map((job) => job.displayName)).toEqual(['Brake Inspection']);
  });

  it('reads a broken or empty saved draft as empty', () => {
    expect(parseDraft('')).toEqual({ answers: {}, tires: {}, notes: '' });
    expect(parseDraft('{oops')).toEqual({ answers: {}, tires: {}, notes: '' });
  });
});
