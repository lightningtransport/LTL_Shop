import { describe, expect, it } from 'vitest';
import {
  isMyAssignedOrInheritedJob,
  jobAssignmentLabel,
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
});
