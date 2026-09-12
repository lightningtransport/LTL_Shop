/**
 * Pure timing helpers — unit-tested, no DB dependency.
 */

export function sessionDurationMs(
  startedAt: Date,
  endedAt: Date | null,
  now: Date = new Date(),
): number {
  const end = endedAt ?? now;
  return Math.max(0, end.getTime() - startedAt.getTime());
}

export function sumDurationsMs(
  segments: { startedAt: Date; endedAt: Date | null }[],
  now: Date = new Date(),
): number {
  return segments.reduce(
    (sum, s) => sum + sessionDurationMs(s.startedAt, s.endedAt, now),
    0,
  );
}

export function officialPausesForTotals<T extends { isOfficialPause?: boolean | null }>(
  pauses: T[],
): T[] {
  return pauses.filter((pause) => pause.isOfficialPause !== false);
}

export function computeTotals(input: {
  sessions: { startedAt: Date; endedAt: Date | null }[];
  pauses: { startedAt: Date; endedAt: Date | null; isOfficialPause?: boolean | null }[];
  now?: Date;
}): { totalActiveLaborMs: number; totalWaitingMs: number } {
  const now = input.now ?? new Date();
  return {
    totalActiveLaborMs: sumDurationsMs(input.sessions, now),
    totalWaitingMs: sumDurationsMs(officialPausesForTotals(input.pauses), now),
  };
}

export function nextDisplayId(seq: number): string {
  return `WO-${String(seq).padStart(3, '0')}`;
}

export function canCompleteJob(status: string): {
  ok: boolean;
  code?: string;
  message?: string;
} {
  if (status === 'waiting_paused') {
    return {
      ok: false,
      code: 'RESUME_REQUIRED',
      message: 'Resume the Work Order before completing jobs.',
    };
  }
  if (status === 'created') {
    return {
      ok: false,
      code: 'START_REQUIRED',
      message: 'Start Work before completing jobs.',
    };
  }
  if (status === 'completed' || status === 'cancelled') {
    return {
      ok: false,
      code: 'WO_CLOSED',
      message: 'This Work Order is closed.',
    };
  }
  return { ok: true };
}

export function canFinishWorkOrder(jobs: { status: string }[]): {
  ok: boolean;
  message?: string;
} {
  const pending = jobs.filter((j) => j.status === 'to_do');
  if (pending.length > 0) {
    return {
      ok: false,
      message: 'This Work Order still has incomplete Jobs.',
    };
  }
  return { ok: true };
}
