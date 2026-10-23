import { describe, expect, it } from 'vitest';
import { holdingJobs, jobsToStart, truckBusyFor, type TruckHolderJob } from './truck-holder';

const job = (id: string, overrides: Partial<TruckHolderJob> = {}): TruckHolderJob => ({
  id,
  status: 'to_do',
  assignedMechanicId: 'mech-a',
  startedAt: new Date('2026-10-22T14:00:00Z'),
  ...overrides,
});

describe('holdingJobs (D57 §3)', () => {
  it('a started, owned, pending Job holds the truck', () => {
    expect(holdingJobs([job('j1')]).map((item) => item.id)).toEqual(['j1']);
  });

  it('an open session alone does not hold the truck: only the Job\'s own start counts', () => {
    expect(holdingJobs([job('j1', { startedAt: null })])).toEqual([]);
  });

  it('blocked, external, Quality Check, completed and unowned Jobs do not hold it', () => {
    expect(holdingJobs([
      job('blocked', { blocked: true }),
      job('external', { external: true }),
      job('qc', { isQualityCheck: true }),
      job('done', { status: 'completed' }),
      job('cancelled', { status: 'cancelled' }),
      job('unowned', { assignedMechanicId: null }),
    ])).toEqual([]);
  });
});

describe('truckBusyFor (D57 §3)', () => {
  it("returns someone else's holding Job", () => {
    const other = job('j1', { assignedMechanicId: 'mech-a' });
    expect(truckBusyFor('mech-b', [other, job('j2', { assignedMechanicId: 'mech-b', startedAt: null })])).toBe(other);
  });

  it('is null when nobody else holds the truck, or only my own Job does', () => {
    expect(truckBusyFor('mech-a', [job('j1')])).toBeNull();
    expect(truckBusyFor('mech-b', [])).toBeNull();
    expect(truckBusyFor('mech-b', [job('j1', { blocked: true })])).toBeNull();
  });

  it('a helper and the owner of the Job they help never block each other', () => {
    const owner = job('owner-job', { assignedMechanicId: 'mech-a' });
    const helper = job('helper-job', { assignedMechanicId: 'mech-b', helperOfJobId: 'owner-job', startedAt: null });
    // The helper starts while the owner holds the truck.
    expect(truckBusyFor('mech-b', [owner, helper])).toBeNull();
    // The owner is not blocked by the helper's started Job either.
    expect(truckBusyFor('mech-a', [owner, { ...helper, startedAt: new Date() }])).toBeNull();
    // Without the link, the helper is blocked.
    expect(truckBusyFor('mech-b', [owner, { ...helper, helperOfJobId: null }])).toBe(owner);
  });
});

describe('helpers of the same Job (D23)', () => {
  it('two helpers of one parent Job do not block each other', () => {
    const parent = job('parent', { assignedMechanicId: 'mech-a' });
    const helperB = job('hb', { assignedMechanicId: 'mech-b', helperOfJobId: 'parent', startedAt: new Date() });
    const helperC = job('hc', { assignedMechanicId: 'mech-c', helperOfJobId: 'parent', startedAt: null });
    expect(truckBusyFor('mech-c', [parent, helperB, helperC])).toBeNull();
  });
});

describe('jobsToStart (D57 §3)', () => {
  const mine = (id: string, overrides: Partial<TruckHolderJob> = {}) =>
    job(id, { assignedMechanicId: 'mech-b', startedAt: null, ...overrides });

  it('with the truck free, marks every pending, workable Job of the mechanic', () => {
    const jobs = [
      mine('a'),
      mine('b'),
      mine('blocked', { blocked: true }),
      mine('external', { external: true }),
      mine('qc', { isQualityCheck: true }),
      mine('done', { status: 'completed' }),
      mine('already', { startedAt: new Date() }),
      job('theirs', { assignedMechanicId: 'mech-a', startedAt: null }),
    ];
    expect(jobsToStart('mech-b', jobs).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('with someone else holding the truck, marks only the Jobs where the mechanic helps', () => {
    const jobs = [
      job('held', { assignedMechanicId: 'mech-a' }),
      mine('own'),
      mine('helping', { helperOfJobId: 'held' }),
      mine('helping-other', { helperOfJobId: 'unrelated' }),
    ];
    expect(jobsToStart('mech-b', jobs).map((item) => item.id)).toEqual(['helping']);
  });
});
