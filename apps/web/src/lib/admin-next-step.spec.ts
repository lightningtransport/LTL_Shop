import { describe, expect, it } from 'vitest';
import { adminNextStep, fillPlaceholders } from './admin-next-step';

const base = {
  status: 'in_progress', categoryName: 'Engine', jobs: [{ status: 'completed' }, { status: 'to_do' }],
  mechanicNames: ['MG'], canManageWorkOrders: false, returnedToServiceAt: null,
};

describe('adminNextStep (LTR-105)', () => {
  it('names the mechanics while Jobs are pending', () => {
    expect(adminNextStep(base)).toEqual({ key: 'nextStepJobsInProgress', values: { names: 'MG', done: '1', total: '2' }, managerOwned: false });
  });

  it('tells a viewer without manage that the Shop Manager closes the Work Order', () => {
    const step = adminNextStep({ ...base, jobs: [{ status: 'completed' }, { status: 'cancelled' }] });
    expect(step).toMatchObject({ key: 'nextStepWaitingManagerClose', managerOwned: true });
  });

  it('leaves the ready-to-close case to the Manager completion card', () => {
    expect(adminNextStep({ ...base, jobs: [{ status: 'completed' }], canManageWorkOrders: true })).toBeNull();
  });

  it('covers created, paused, PM, empty, and completed Work Orders', () => {
    expect(adminNextStep({ ...base, status: 'created', mechanicNames: [] })?.key).toBe('nextStepAssignMechanic');
    expect(adminNextStep({ ...base, status: 'created' })?.key).toBe('nextStepMechanicStart');
    expect(adminNextStep({ ...base, status: 'waiting_paused', pauseReasonLabel: 'Waiting for Parts' })).toMatchObject({ key: 'nextStepPaused', values: { reason: 'Waiting for Parts' } });
    expect(adminNextStep({ ...base, categoryName: 'PM', jobs: [] })?.key).toBe('nextStepPmFinish');
    expect(adminNextStep({ ...base, jobs: [] })?.key).toBe('nextStepAddJobs');
    expect(adminNextStep({ ...base, status: 'completed' })?.key).toBe('nextStepReturnToService');
    expect(adminNextStep({ ...base, status: 'completed', returnedToServiceAt: '2026-09-25T00:00:00Z' })).toBeNull();
    expect(adminNextStep({ ...base, status: 'cancelled' })).toBeNull();
  });

  it('fills placeholders and keeps unknown ones', () => {
    expect(fillPlaceholders('{names} · {done}/{total} {x}', { names: 'MG', done: '1', total: '2' })).toBe('MG · 1/2 {x}');
  });
});
