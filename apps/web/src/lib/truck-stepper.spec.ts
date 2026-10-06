import { describe, expect, it } from 'vitest';
import type { TruckWorkPlanDto } from '@ltl-shop/shared';
import { truckStatusChip, truckSteps, truckStepStartsOpen } from './truck-stepper';

const phase = (status: string, extra: Record<string, unknown> = {}) => ({ required: true, status, jobCount: 1, remainingCount: status === 'complete' ? 0 : 1, ...extra });

function plan(extra: Record<string, unknown> = {}): TruckWorkPlanDto {
  return {
    sliceEnabled: true,
    inspection: { outcome: 'issues_found' },
    workOrder: { id: 'wo', displayId: 'WO-1', status: 'in_progress', version: 1, primaryCategoryName: 'Engine' },
    jobs: [],
    remainingJobCount: 1,
    readiness: 'not_ready',
    readyReason: 'jobs_remaining',
    phase: 'shop_work',
    mandatory: { pm: phase('complete'), alignment: phase('pending'), detailing: phase('pending', { jobCount: 0 }), qualityCheck: phase('not_applicable', { required: false }) },
    capabilities: { canRead: true, canAddWork: true, canRecordInspection: true },
    phase1: { assessmentId: null, gatesRemainDefault: true },
    ...extra,
  } as TruckWorkPlanDto;
}

const job = (lane: string, uiStatus: string, status = 'to_do') => ({ id: `${lane}-${uiStatus}`, lane, uiStatus, status }) as TruckWorkPlanDto['jobs'][number];

describe('Truck readiness steps (stage 4 / UX-4-001)', () => {
  it('without a Work Order only the arrival inspection exists', () => {
    expect(truckSteps(plan({ workOrder: null, inspection: { outcome: 'not_started' } as TruckWorkPlanDto['inspection'] }))).toEqual([
      { key: 'inspection', state: 'pending', remaining: 0 },
    ]);
  });

  it('lays out each step from the Work Plan, a blocked Job holding its step', () => {
    const steps = truckSteps(plan({ jobs: [job('shop_work', 'blocked'), job('shop_work', 'completed', 'completed'), job('alignment', 'external')] }));
    expect(steps.map((step) => [step.key, step.state, step.remaining])).toEqual([
      ['inspection', 'done', 0],
      ['shop_work', 'blocked', 1],
      ['pm', 'done', 0],
      ['alignment', 'external', 1],
      ['detailing', 'missing', 0],
      ['quality_check', 'not_applicable', 0],
      ['close', 'waiting', 0],
    ]);
    expect(steps.filter(truckStepStartsOpen).map((step) => step.key)).toEqual(['shop_work', 'alignment', 'detailing']);
  });

  it('Shop Work with no Jobs does not apply; close is ready when only the Work Order is open', () => {
    const steps = truckSteps(plan({ readyReason: 'work_order_open' }));
    expect(steps.find((step) => step.key === 'shop_work')?.state).toBe('not_applicable');
    expect(steps.find((step) => step.key === 'close')?.state).toBe('ready');
  });

  it('the header has one status chip', () => {
    expect(truckStatusChip(plan(), 'unknown')).toBe('not_ready');
    expect(truckStatusChip(plan({ phase: 'ready_to_close' }), 'unknown')).toBe('ready_to_close');
    expect(truckStatusChip(plan({ readiness: 'ready' }), 'unknown')).toBe('ready_to_go');
    expect(truckStatusChip(plan({ workOrder: null }), 'in_service')).toBe('in_service');
    expect(truckStatusChip(plan({ workOrder: null }), 'unknown')).toBe('no_work_order');
  });
});
