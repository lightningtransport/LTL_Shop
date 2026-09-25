import { describe, expect, it } from 'vitest';
import {
  isMyAssignedOrInheritedJob,
  isStandardWorkWaitingOnManager,
  jobAssignmentLabel,
  jobPersonLabel,
  workOrderTeamLabel,
} from './job-assignment';

const copy = {
  assignedToYou: 'Assigned to you',
  assignedTo: (name: string) => `Assigned to ${name}`,
  jobUnassignedInheritsTeam: 'Unassigned — inherits the Work Order team',
  workOrderTeam: 'Work Order team',
  noWorkOrderTeam: 'No Work Order team assigned',
};

describe('job assignment presentation', () => {
  it('treats unassigned Jobs as inherited team work for the current mechanic', () => {
    expect(isMyAssignedOrInheritedJob(null, 'mechanic-1')).toBe(true);
    expect(jobAssignmentLabel(null, 'mechanic-1', copy)).toBe(copy.jobUnassignedInheritsTeam);
  });

  it('labels Jobs assigned to the current mechanic versus another mechanic', () => {
    expect(isMyAssignedOrInheritedJob({ id: 'mechanic-1', name: 'Alex' }, 'mechanic-1')).toBe(true);
    expect(isMyAssignedOrInheritedJob({ id: 'mechanic-2', name: 'Jamie' }, 'mechanic-1')).toBe(false);
    expect(jobAssignmentLabel({ id: 'mechanic-1', name: 'Alex' }, 'mechanic-1', copy)).toBe('Assigned to you');
    expect(jobAssignmentLabel({ id: 'mechanic-2', name: 'Jamie' }, 'mechanic-1', copy)).toBe('Assigned to Jamie');
  });

  it('renders the Work Order team or an explicit empty-team label', () => {
    expect(workOrderTeamLabel([
      { mechanicName: 'Alex Mechanic' },
      { mechanicName: 'Jamie Technician' },
    ], copy)).toBe('Work Order team: Alex Mechanic / Jamie Technician');
    expect(workOrderTeamLabel([], copy)).toBe('No Work Order team assigned');
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
    jobUnassignedInheritsTeam: 'Unassigned — inherits the Work Order team',
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
      .toBe('Unassigned — inherits the Work Order team');
  });
});
