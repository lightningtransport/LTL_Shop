import { describe, expect, it } from 'vitest';
import { WorkPlanInspectionOutcome, WorkPlanJobLane } from './enums';
import { deriveTruckNextStep, type TruckNextStepInput } from './truck-next-step';

const alex = { id: 'alex', name: 'Alex' };
const job = (id: string, lane: WorkPlanJobLane, status = 'to_do', owner: typeof alex | null = alex) => ({
  id, displayName: id, status, lane, assignedMechanic: owner,
});
const fullPlan = () => [
  job('Brakes', WorkPlanJobLane.SHOP_WORK),
  job('PM A Service', WorkPlanJobLane.PM),
  job('Alignment', WorkPlanJobLane.ALIGNMENT),
  job('Detailing', WorkPlanJobLane.DETAILING),
  job('Quality Check', WorkPlanJobLane.QUALITY_CHECK, 'to_do', null),
];
const base = (overrides: Partial<TruckNextStepInput> = {}): TruckNextStepInput => ({
  workOrder: { id: 'wo-1', status: 'in_progress' },
  inspectionOutcome: WorkPlanInspectionOutcome.ISSUES_FOUND,
  jobs: fullPlan(),
  activeBlocker: null,
  currentPause: null,
  ...overrides,
});

describe('deriveTruckNextStep (LTR-158 / D14)', () => {
  it('create_work_order when the Truck has no Work Order', () => {
    expect(deriveTruckNextStep(base({ workOrder: null }))).toEqual({ kind: 'create_work_order' });
  });

  it('resolve_blocker comes first, with the Job, reason and reporter', () => {
    expect(deriveTruckNextStep(base({
      inspectionOutcome: WorkPlanInspectionOutcome.NOT_STARTED,
      activeBlocker: {
        id: 'b-1', reason: 'waiting_for_parts', blockerReason: 'waiting_for_parts',
        job: { id: 'Detailing', displayName: 'Detailing' }, reportedBy: { name: 'Alex' }, startedAt: '2026-09-28T10:00:00Z',
      },
    }))).toEqual({
      kind: 'resolve_blocker', workOrderId: 'wo-1', blockerId: 'b-1', jobId: 'Detailing', jobName: 'Detailing',
      reason: 'waiting_for_parts', reportedBy: 'Alex', reportedAt: '2026-09-28T10:00:00Z',
    });
  });

  it('resume when the Manager paused the Work Order', () => {
    expect(deriveTruckNextStep(base({ workOrder: { id: 'wo-1', status: 'waiting_paused' }, currentPause: { reason: 'waiting_for_approval' } })))
      .toEqual({ kind: 'resume', workOrderId: 'wo-1', reason: 'waiting_for_approval' });
  });

  it('inspect while the inspection is not recorded', () => {
    expect(deriveTruckNextStep(base({ inspectionOutcome: WorkPlanInspectionOutcome.NOT_STARTED })))
      .toEqual({ kind: 'inspect', workOrderId: 'wo-1' });
  });

  it('add_missing_steps for an old Work Order without the mandatory steps', () => {
    expect(deriveTruckNextStep(base({ jobs: [job('Brakes', WorkPlanJobLane.SHOP_WORK), job('Detailing', WorkPlanJobLane.DETAILING)] })))
      .toEqual({
        kind: 'add_missing_steps', workOrderId: 'wo-1',
        missingLanes: [WorkPlanJobLane.PM, WorkPlanJobLane.ALIGNMENT, WorkPlanJobLane.QUALITY_CHECK],
      });
  });

  it('a step cancelled as "not applicable" is not missing', () => {
    const jobs = fullPlan().map((item) => (item.lane === WorkPlanJobLane.PM ? { ...item, status: 'cancelled' } : item));
    expect(deriveTruckNextStep(base({ jobs }))?.kind).toBe('work');
  });

  it('assign the first unassigned pending Job in flow order; QC never needs an owner', () => {
    const jobs = fullPlan().map((item) => (item.lane === WorkPlanJobLane.DETAILING || item.lane === WorkPlanJobLane.ALIGNMENT ? { ...item, assignedMechanic: null } : item));
    expect(deriveTruckNextStep(base({ jobs }))).toEqual({ kind: 'assign', workOrderId: 'wo-1', jobId: 'Alignment', jobName: 'Alignment' });
  });

  it('work while mechanics still have Jobs, naming the next one', () => {
    expect(deriveTruckNextStep(base())).toEqual({ kind: 'work', workOrderId: 'wo-1', jobId: 'Brakes', jobName: 'Brakes', remaining: 5 });
  });

  it('qc when only Quality Check is left', () => {
    const jobs = fullPlan().map((item) => (item.lane === WorkPlanJobLane.QUALITY_CHECK ? item : { ...item, status: 'completed' }));
    expect(deriveTruckNextStep(base({ jobs }))).toEqual({ kind: 'qc', workOrderId: 'wo-1', jobId: 'Quality Check', jobName: 'Quality Check' });
  });

  it('close when every Job is done', () => {
    const jobs = fullPlan().map((item) => ({ ...item, status: 'completed' }));
    expect(deriveTruckNextStep(base({ jobs }))).toEqual({ kind: 'close', workOrderId: 'wo-1' });
  });

  it('return_to_service while the completed Work Order keeps the Truck Ready to Go', () => {
    expect(deriveTruckNextStep(base({ workOrder: { id: 'wo-1', status: 'completed' } })))
      .toEqual({ kind: 'return_to_service', workOrderId: 'wo-1' });
  });

  it('nothing for a cancelled Work Order', () => {
    expect(deriveTruckNextStep(base({ workOrder: { id: 'wo-1', status: 'cancelled' } }))).toBeNull();
  });
});
