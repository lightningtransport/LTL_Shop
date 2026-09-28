import { describe, expect, it } from 'vitest';
import type { WorkOrderDetailDto, WorkOrderJobDto } from '@ltl-shop/shared';
import { optimisticCompleteJob } from './optimistic-complete-job';

const me = { id: 'ma', name: 'MA' };
const other = { id: 'md', name: 'MD' };

function job(id: string, owner: { id: string; name: string } | null, extra: Partial<WorkOrderJobDto> = {}) {
  return { id, displayName: id, status: 'to_do', workStatus: 'in_progress', assignedMechanic: owner, ...extra } as WorkOrderJobDto;
}

function detail(jobs: WorkOrderJobDto[], mine: WorkOrderJobDto[]): WorkOrderDetailDto {
  return {
    jobs,
    myJobs: mine,
    otherJobs: jobs.filter((item) => !mine.includes(item)),
    myPartDone: false,
    laborRunning: true,
    jobsCompleted: 0,
    version: 3,
  } as unknown as WorkOrderDetailDto;
}

describe('optimisticCompleteJob (LTR-164 #7)', () => {
  it('moves the last Job out of Your Jobs, marks the part done and stops the time', () => {
    const alignment = job('alignment', me);
    const next = optimisticCompleteJob(detail([alignment, job('detailing', other)], [alignment]), 'alignment', 'ma', null, '2026-09-28T17:00:00.000Z');

    expect(next.myJobs?.[0]).toMatchObject({ status: 'completed', workStatus: 'completed', completedById: 'ma' });
    expect(next.jobs[0]?.status).toBe('completed');
    expect(next.myPartDone).toBe(true);
    expect(next.laborRunning).toBe(false);
    expect(next.jobsCompleted).toBe(1);
    expect(next.version).toBe(4);
  });

  it('keeps the time running while the mechanic has another Job to work on', () => {
    const first = job('first', me);
    const second = job('second', me);
    const next = optimisticCompleteJob(detail([first, second], [first, second]), 'first', 'ma', 'done', '2026-09-28T17:00:00.000Z');

    expect(next.myPartDone).toBe(false);
    expect(next.laborRunning).toBe(true);
  });

  it('stops the time when the only Job left is blocked', () => {
    const first = job('first', me);
    const blocked = job('blocked', me, { activeBlocker: { id: 'b1' } as WorkOrderJobDto['activeBlocker'] });
    const next = optimisticCompleteJob(detail([first, blocked], [first, blocked]), 'first', 'ma', null, '2026-09-28T17:00:00.000Z');

    expect(next.myPartDone).toBe(false);
    expect(next.laborRunning).toBe(false);
  });
});
