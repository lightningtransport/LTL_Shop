import { describe, expect, it } from 'vitest';
import { workOrderTeam } from './work-order-team';

const created = new Date('2026-09-28T13:00:00.000Z');

describe('workOrderTeam (LTR-164 #11 / D11)', () => {
  it('adds the PM owner, who has no mechanic assignment, after the assigned team', () => {
    const team = workOrderTeam(
      [{ mechanicId: 'mg', mechanic: { name: 'MG' }, addedAt: created }],
      [
        { status: 'completed', assignedMechanic: { id: 'mg', name: 'MG' } },
        { status: 'completed', assignedMechanic: { id: 'mpm', name: 'MPM' }, addedAt: created },
      ],
      created,
    );
    expect(team.map((member) => member.mechanicName)).toEqual(['MG', 'MPM']);
  });

  it('skips removed assignments, cancelled Jobs and unassigned Jobs', () => {
    const team = workOrderTeam(
      [{ mechanicId: 'old', mechanic: { name: 'Old' }, addedAt: created, removedAt: created }],
      [
        { status: 'cancelled', assignedMechanic: { id: 'ma', name: 'MA' } },
        { status: 'to_do', assignedMechanic: null },
        { status: 'to_do', assignedMechanic: { id: 'md', name: 'MD' } },
      ],
      created,
    );
    expect(team).toEqual([{ mechanicId: 'md', mechanicName: 'MD', addedAt: created }]);
  });
});
