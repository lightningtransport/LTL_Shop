import { describe, expect, it } from 'vitest';
import { JobStatus } from './enums';
import { jobWorkStatus } from './job-work-status';

const open = (userId: string | null) => ({ endedAt: null, userId });
const closed = (userId: string) => ({ endedAt: new Date(), userId });

describe('jobWorkStatus (LTR-154 / D18)', () => {
  it('is In Progress only while its own assignee has an open session', () => {
    const job = { status: JobStatus.TO_DO, assignedMechanicId: 'a' };
    expect(jobWorkStatus(job, [open('a')])).toBe('in_progress');
    expect(jobWorkStatus(job, [open('b')])).toBe('pending');
    expect(jobWorkStatus(job, [closed('a')])).toBe('pending');
    expect(jobWorkStatus(job, [])).toBe('pending');
  });

  it('keeps an unassigned Job pending even while someone works the Work Order', () => {
    expect(jobWorkStatus({ status: JobStatus.TO_DO, assignedMechanicId: null }, [open('a')])).toBe('pending');
  });

  it('treats a session without userId as covering every assignee', () => {
    expect(jobWorkStatus({ status: JobStatus.TO_DO, assignedMechanicId: 'a' }, [open(null)])).toBe('in_progress');
  });

  it('uses startedAt for the PM job and passes closed states through', () => {
    expect(jobWorkStatus({ status: JobStatus.TO_DO, assignedMechanicId: 'p', isPm: true, startedAt: new Date() }, [])).toBe('in_progress');
    expect(jobWorkStatus({ status: JobStatus.TO_DO, assignedMechanicId: 'p', isPm: true }, [open('p')])).toBe('pending');
    expect(jobWorkStatus({ status: JobStatus.COMPLETED, assignedMechanicId: 'a' }, [open('a')])).toBe('completed');
    expect(jobWorkStatus({ status: JobStatus.CANCELLED, assignedMechanicId: 'a' }, [])).toBe('cancelled');
  });
});
