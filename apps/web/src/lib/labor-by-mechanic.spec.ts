import { describe, expect, it } from 'vitest';
import { laborByMechanic } from './labor-by-mechanic';

describe('laborByMechanic (LTR-184 / D18)', () => {
  it('sums each mechanic\'s sessions and keeps pre-LTR-154 sessions apart', () => {
    const totals = laborByMechanic({
      laborSessions: [
        { id: 's1', startedAt: '2026-09-29T10:00:00Z', endedAt: '2026-09-29T10:30:00Z', durationMs: 30 * 60_000, mechanic: { id: 'a', name: 'Anthony' } },
        { id: 's2', startedAt: '2026-09-29T11:00:00Z', endedAt: '2026-09-29T11:15:00Z', durationMs: 15 * 60_000, mechanic: { id: 'a', name: 'Anthony' } },
        { id: 's3', startedAt: '2026-09-29T10:00:00Z', endedAt: '2026-09-29T10:10:00Z', durationMs: 10 * 60_000, mechanic: { id: 'b', name: 'Alejandro 1' } },
        { id: 's4', startedAt: '2026-09-01T10:00:00Z', endedAt: '2026-09-01T10:05:00Z', durationMs: 5 * 60_000, mechanic: null },
      ],
    });
    expect(totals).toEqual([
      { key: 'a', name: 'Anthony', totalMs: 45 * 60_000 },
      { key: 'b', name: 'Alejandro 1', totalMs: 10 * 60_000 },
      { key: 'unattributed', name: null, totalMs: 5 * 60_000 },
    ]);
  });

  it('is empty without sessions', () => {
    expect(laborByMechanic({ laborSessions: [] })).toEqual([]);
  });
});
