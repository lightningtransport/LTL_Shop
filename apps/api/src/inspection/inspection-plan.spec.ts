import { WorkOrderJobSourceKind } from '@ltl-shop/shared';
import { describe, expect, it } from 'vitest';
import { planInspectionFindings, type PlanFinding, type PlanWorkOrderJob } from './inspection-plan';

const LIGHTS = 'cat-lights';
const BRAKES = 'cat-brakes';
const FLAT = 'cat-flat';
const item = (id: string, catalogJobId: string | null, workflowStepKey: string | null = null): PlanFinding => ({
  catalogJobId,
  workflowStepKey,
  source: { kind: WorkOrderJobSourceKind.INSPECTION_ITEM, inspectionItemId: id, note: `note ${id}` },
});
const tire = (id: string, catalogJobId: string): PlanFinding => ({
  catalogJobId,
  workflowStepKey: null,
  source: { kind: WorkOrderJobSourceKind.TIRE_READING, tireReadingId: id, note: `tire ${id}` },
});
const woJob = (id: string, over: Partial<PlanWorkOrderJob> = {}): PlanWorkOrderJob => ({
  id,
  catalogJobId: null,
  status: 'to_do',
  helperOfJobId: null,
  isDetailing: false,
  ...over,
});
const detailing = woJob('job-detailing', { isDetailing: true, catalogJobId: 'cat-detailing' });

describe('D41 inspection plan', () => {
  it('merges defects that point to the same catalog Job into one new Job', () => {
    const plan = planInspectionFindings([item('fog', LIGHTS), item('brake-lights', LIGHTS), item('brakes', BRAKES)], [detailing]);
    expect(plan.create).toEqual([
      { catalogJobId: LIGHTS, sources: [expect.objectContaining({ inspectionItemId: 'fog' }), expect.objectContaining({ inspectionItemId: 'brake-lights' })] },
      { catalogJobId: BRAKES, sources: [expect.objectContaining({ inspectionItemId: 'brakes' })] },
    ]);
    expect(plan.attach).toEqual([]);
  });

  it('adds the finding to a Job already on the Work Order instead of repeating it', () => {
    const plan = planInspectionFindings([item('fog', LIGHTS)], [detailing, woJob('job-lights', { catalogJobId: LIGHTS })]);
    expect(plan.create).toEqual([]);
    expect(plan.attach).toEqual([{ jobId: 'job-lights', sources: [expect.objectContaining({ inspectionItemId: 'fog' })] }]);
  });

  it('ignores cancelled Jobs and helper Jobs when looking for the existing one', () => {
    const jobs = [detailing, woJob('cancelled', { catalogJobId: LIGHTS, status: 'cancelled' }), woJob('helper', { catalogJobId: LIGHTS, helperOfJobId: 'x' })];
    expect(planInspectionFindings([item('fog', LIGHTS)], jobs).create).toHaveLength(1);
  });

  it('sends cleaning checks to the Detailing step the Work Order already has', () => {
    const plan = planInspectionFindings([item('windows', null, 'detailing'), item('interior', null, 'detailing')], [detailing]);
    expect(plan.create).toEqual([]);
    expect(plan.attach).toEqual([{ jobId: 'job-detailing', sources: [expect.objectContaining({ inspectionItemId: 'windows' }), expect.objectContaining({ inspectionItemId: 'interior' })] }]);
  });

  it('refuses a cleaning defect when the Work Order has no Detailing step', () => {
    expect(() => planInspectionFindings([item('windows', null, 'detailing')], [])).toThrow('DETAILING_STEP_MISSING');
  });

  it('treats a tire to fix like any other finding (two low tires → one Flat Repair)', () => {
    const plan = planInspectionFindings([tire('lfo', FLAT), tire('rro', FLAT)], [detailing]);
    expect(plan.create).toEqual([{ catalogJobId: FLAT, sources: [expect.objectContaining({ tireReadingId: 'lfo' }), expect.objectContaining({ tireReadingId: 'rro' })] }]);
  });
});
