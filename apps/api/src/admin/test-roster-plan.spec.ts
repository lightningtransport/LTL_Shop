import { describe, expect, it } from 'vitest';
import { planRosterReset, TEST_ROSTER, type RosterUser } from './test-roster-plan';

function user(overrides: Partial<RosterUser> & Pick<RosterUser, 'email'>): RosterUser {
  return { id: overrides.email, name: overrides.email, role: 'mechanic', active: true, pmAuthorized: false, capabilities: [], openWork: [], ...overrides };
}

describe('test roster reset plan (LTR-160)', () => {
  it('creates missing test users, fixes roles/capabilities, and deactivates everyone else', () => {
    const plan = planRosterReset([
      user({ email: 'Cristian240588@hotmail.com', name: 'MG', role: 'admin', capabilities: ['ADMIN_ACCESS', 'MECHANIC_STANDARD', 'MECHANIC_PM'] }),
      user({ email: 'cristian@ltransl.com', name: 'Cristian', capabilities: ['MECHANIC_STANDARD'] }),
      user({ email: 'ibrain@ltransl.com', name: 'Ibrain', role: 'admin', capabilities: ['ADMIN_ACCESS'] }),
      user({ email: 'retired@lightning.local', active: false }),
    ]);

    const kinds = Object.fromEntries(plan.actions.map((action) => [
      'target' in action ? action.target.email : action.user.email,
      action.kind,
    ]));
    expect(kinds).toEqual({
      'crixcrox@outlook.com': 'create',
      'cristian@ltransl.com': 'update',
      'cristian240588@hotmail.com': 'update',
      'cris240588@gmail.com': 'create',
      'cris240588+detailing@gmail.com': 'create',
      'cris240588+alignment@gmail.com': 'create',
      'ibrain@ltransl.com': 'deactivate',
      'retired@lightning.local': 'already_inactive',
    });
    expect(plan.pendingChanges).toBe(7);
    expect(plan.blockers).toEqual([]);
  });

  it('reports no pending changes once the roster matches', () => {
    const users = TEST_ROSTER.map((target) => user({
      email: target.email, name: target.name, role: target.role, capabilities: target.capabilities,
      pmAuthorized: target.capabilities.includes('MECHANIC_PM'),
    }));
    const plan = planRosterReset([...users, user({ email: 'old@lightning.local', active: false })]);
    expect(plan.pendingChanges).toBe(0);
    expect(plan.actions.filter((action) => action.kind === 'keep')).toHaveLength(TEST_ROSTER.length);
  });

  it('blocks deactivating a user that still has open work', () => {
    const plan = planRosterReset([user({ email: 'anthony@pending.lightning.local', openWork: ['WO-0101 assigned job'] })]);
    expect(plan.blockers).toEqual([{ email: 'anthony@pending.lightning.local', openWork: ['WO-0101 assigned job'] }]);
  });
});
