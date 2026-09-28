import { describe, expect, it } from 'vitest';
import {
  canCompleteJobFromWorkOrder,
  isMyJob,
  isMyPartDone,
  isStandardWorkWaitingOnManager,
  jobAssignmentLabel,
  jobPersonLabel,
  splitMyJobs,
} from './job-assignment';

const copy = {
  assignedToYou: 'Assigned to you',
  assignedTo: (name: string) => `Assigned to ${name}`,
  jobUnassigned: 'Unassigned',
};

describe('job assignment presentation', () => {
  it('does not treat unassigned Jobs as mine (LTR-154 / D11)', () => {
    expect(isMyJob(null, 'mechanic-1')).toBe(false);
    expect(jobAssignmentLabel(null, 'mechanic-1', copy)).toBe(copy.jobUnassigned);
  });

  it('labels Jobs assigned to the current mechanic versus another mechanic', () => {
    expect(isMyJob({ id: 'mechanic-1', name: 'Alex' }, 'mechanic-1')).toBe(true);
    expect(isMyJob({ id: 'mechanic-2', name: 'Jamie' }, 'mechanic-1')).toBe(false);
    expect(jobAssignmentLabel({ id: 'mechanic-1', name: 'Alex' }, 'mechanic-1', copy)).toBe('Assigned to you');
    expect(jobAssignmentLabel({ id: 'mechanic-2', name: 'Jamie' }, 'mechanic-1', copy)).toBe('Assigned to Jamie');
  });

  it('treats in-progress Standard Work Orders with no to-do Jobs as waiting on the Manager', () => {
    expect(isStandardWorkWaitingOnManager({
      status: 'in_progress',
      primaryCategoryName: 'Inspection',
      jobs: [{ status: 'completed' }],
    })).toBe(true);
    expect(isStandardWorkWaitingOnManager({
      status: 'in_progress',
      primaryCategoryName: 'Inspection',
      jobs: [{ status: 'to_do' }, { status: 'completed' }],
    })).toBe(false);
    expect(isStandardWorkWaitingOnManager({
      status: 'in_progress',
      primaryCategoryName: 'PM',
      jobs: [],
    })).toBe(false);
    expect(isStandardWorkWaitingOnManager({
      status: 'created',
      primaryCategoryName: 'Inspection',
      jobs: [{ status: 'completed' }],
    })).toBe(false);
  });
});

describe('jobPersonLabel (LTR-127)', () => {
  const copy = {
    assignedToYou: 'Assigned to you',
    assignedTo: (name: string) => `Assigned to ${name}`,
    jobUnassigned: 'Unassigned',
    completedByYou: 'Completed by you',
    completedBy: (name: string) => `Completed by ${name}`,
  };

  it('shows who completed a completed Job instead of its assignment', () => {
    expect(jobPersonLabel({ status: 'completed', assignedMechanic: null, completedBy: { id: 'mg', name: 'MG' } }, 'mg', copy))
      .toBe('Completed by you');
    expect(jobPersonLabel({ status: 'completed', assignedMechanic: { id: 'mg', name: 'MG' }, completedBy: { id: 'c', name: 'Cristian' } }, 'mg', copy))
      .toBe('Completed by Cristian');
  });

  it('keeps the assignment line for Jobs to do and for older responses', () => {
    expect(jobPersonLabel({ status: 'to_do', assignedMechanic: { id: 'mg', name: 'MG' } }, 'mg', copy)).toBe('Assigned to you');
    expect(jobPersonLabel({ status: 'completed', assignedMechanic: null }, 'mg', copy))
      .toBe('Unassigned');
  });
});

describe('Job completion from the Work Order (LTR-151, LTR-154 / D11)', () => {
  it('offers "Complete job" only to the Job assignee', () => {
    const pmJob = { assignedMechanic: { id: 'pm-mechanic', name: 'Daniel' } };
    expect(canCompleteJobFromWorkOrder(pmJob, 'pm-mechanic')).toBe(true);
    expect(canCompleteJobFromWorkOrder(pmJob, 'standard-mechanic')).toBe(false);
    expect(canCompleteJobFromWorkOrder({ assignedMechanic: null }, 'standard-mechanic')).toBe(false);
  });
});

describe('splitMyJobs / isMyPartDone (LTR-154)', () => {
  const alex = { id: 'mechanic-1', name: 'Alex' };
  const jamie = { id: 'mechanic-2', name: 'Jamie' };
  const jobs = [
    { id: 'mine-done', status: 'completed', assignedMechanic: alex },
    { id: 'theirs', status: 'to_do', assignedMechanic: jamie },
    { id: 'unassigned', status: 'to_do', assignedMechanic: null },
    { id: 'cancelled', status: 'cancelled', assignedMechanic: alex },
  ];

  it('splits my Jobs from the rest of the truck and knows when my part is done', () => {
    const split = splitMyJobs({ jobs }, 'mechanic-1');
    expect(split.mine.map((job) => job.id)).toEqual(['mine-done']);
    expect(split.others.map((job) => job.id)).toEqual(['theirs', 'unassigned']);
    expect(split.partDone).toBe(true);
  });

  it('prefers the API split when present', () => {
    const split = splitMyJobs({ jobs, myJobs: [], otherJobs: jobs.slice(0, 1), myPartDone: false }, 'mechanic-1');
    expect(split).toEqual({ mine: [], others: jobs.slice(0, 1), partDone: false });
  });

  it('moves an in-progress Work Order to Waiting on Manager once my part is done', () => {
    const wo = { status: 'in_progress', primaryCategoryName: 'Brakes', jobs };
    expect(isMyPartDone(wo, 'mechanic-1')).toBe(true);
    expect(isMyPartDone(wo, 'mechanic-2')).toBe(false);
    expect(isMyPartDone({ ...wo, status: 'created' }, 'mechanic-1')).toBe(false);
  });
});
