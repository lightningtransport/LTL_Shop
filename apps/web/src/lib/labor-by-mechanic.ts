import type { AdminWorkOrderDetailDto } from '@ltl-shop/shared';

/** LTR-184 / D18: each mechanic's clock, summed from their sessions (open ones count to now). */
export function laborByMechanic(data: Pick<AdminWorkOrderDetailDto, 'laborSessions'>) {
  const totals = new Map<string, { key: string; name: string | null; totalMs: number }>();
  for (const session of data.laborSessions ?? []) {
    const key = session.mechanic?.id ?? 'unattributed';
    const duration = session.durationMs ?? Math.max(0, Date.now() - new Date(session.startedAt).getTime());
    const entry = totals.get(key) ?? { key, name: session.mechanic?.name ?? null, totalMs: 0 };
    entry.totalMs += duration;
    totals.set(key, entry);
  }
  return [...totals.values()];
}
