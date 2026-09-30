import { describe, expect, it } from 'vitest';
import type { WorkOrderSummaryDto } from '@ltl-shop/shared';
import { myCompletedJobs } from './my-completed-jobs';

const me = { id: 'me', name: 'Me' };
const other = { id: 'other', name: 'Other' };

function wo(id: string, status: string, jobs: Array<Record<string, unknown>>): WorkOrderSummaryDto {
  return {
    id,
    displayId: id,
    status,
    jobs: jobs.map((job, index) => ({ id: `${id}-${index}`, displayName: `Job ${index}`, status: 'to_do', assignedMechanic: null, ...job })),
  } as unknown as WorkOrderSummaryDto;
}

describe('myCompletedJobs (LTR-189 W11)', () => {
  it('lists only the Jobs I completed, on open and closed Work Orders, open first', () => {
    const lists = {
      active: [wo('WO-5', 'in_progress', [{ status: 'completed', completedBy: me }, { status: 'to_do', assignedMechanic: me }])],
      created: [wo('WO-2', 'created', [{ status: 'to_do', assignedMechanic: me }])],
      completed: [wo('WO-1', 'completed', [{ status: 'completed', completedBy: me }, { status: 'completed', completedBy: other }])],
    };
    const groups = myCompletedJobs(lists, 'me');
    expect(groups.map((group) => group.wo.id)).toEqual(['WO-5', 'WO-1']);
    expect(groups[0].jobs).toHaveLength(1);
    expect(groups[1].jobs).toHaveLength(1);
  });

  it('ignores Jobs completed by someone else and empty input', () => {
    expect(myCompletedJobs({ completed: [wo('WO-1', 'completed', [{ status: 'completed', completedBy: other }])] }, 'me')).toEqual([]);
    expect(myCompletedJobs(undefined, 'me')).toEqual([]);
    expect(myCompletedJobs({ active: [] }, '')).toEqual([]);
  });
});
