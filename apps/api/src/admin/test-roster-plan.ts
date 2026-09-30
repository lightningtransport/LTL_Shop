/**
 * LTR-160: while Flujo v3 is finished, production keeps only a fixed set of test accounts active.
 * Everyone else is deactivated (never deleted: their history is referenced by RESTRICT foreign keys).
 * This module is pure so the plan can be reviewed in a dry-run and unit-tested without a database.
 */

export type RosterRole = 'mechanic' | 'manager' | 'admin';
export type RosterCapability =
  | 'ADMIN_ACCESS'
  | 'MECHANIC_STANDARD'
  | 'MECHANIC_PM'
  | 'YARD_OPERATIONS_MANAGE'
  | 'WORK_ORDERS_MANAGE'
  | 'QUALITY_CHECK_PERFORM';

export interface RosterTarget {
  email: string;
  name: string;
  role: RosterRole;
  capabilities: RosterCapability[];
}

export interface RosterUser {
  id: string;
  email: string;
  name: string;
  role: RosterRole;
  active: boolean;
  pmAuthorized: boolean;
  capabilities: RosterCapability[];
  /** Open Work Orders, to-do Jobs, or active assignments on open Work Orders that still point at this user. */
  openWork: string[];
}

const MANAGE: RosterCapability[] = ['ADMIN_ACCESS', 'WORK_ORDERS_MANAGE', 'YARD_OPERATIONS_MANAGE'];

export const TEST_ROSTER: RosterTarget[] = [
  { email: 'crixcrox@outlook.com', name: 'Crixcrox', role: 'admin', capabilities: MANAGE },
  { email: 'cristian@ltransl.com', name: 'Cristian', role: 'manager', capabilities: MANAGE },
  { email: 'cristian240588@hotmail.com', name: 'MG', role: 'mechanic', capabilities: ['MECHANIC_STANDARD'] },
  { email: 'cris240588@gmail.com', name: 'MPM', role: 'mechanic', capabilities: ['MECHANIC_PM'] },
  // LTR-99: test owners for the Detailing and Alignment steps (Gmail + addressing, same inbox as MPM).
  { email: 'cris240588+detailing@gmail.com', name: 'MD', role: 'mechanic', capabilities: ['MECHANIC_STANDARD'] },
  { email: 'cris240588+alignment@gmail.com', name: 'MA', role: 'mechanic', capabilities: ['MECHANIC_STANDARD'] },
];

export type RosterAction =
  | { kind: 'create'; target: RosterTarget }
  | { kind: 'update'; userId: string; target: RosterTarget; changes: string[] }
  | { kind: 'keep'; userId: string; target: RosterTarget }
  | { kind: 'deactivate'; user: RosterUser }
  | { kind: 'already_inactive'; user: RosterUser };

export interface RosterPlan {
  actions: RosterAction[];
  /** Users that would be deactivated while open work still points at them. The script refuses to apply. */
  blockers: { email: string; openWork: string[] }[];
  pendingChanges: number;
}

function sameSet(left: string[], right: string[]) {
  return left.length === right.length && [...left].sort().join() === [...right].sort().join();
}

export function planRosterReset(users: RosterUser[], roster: RosterTarget[] = TEST_ROSTER): RosterPlan {
  const byEmail = new Map(users.map((user) => [user.email.trim().toLowerCase(), user]));
  const keepEmails = new Set(roster.map((target) => target.email.toLowerCase()));
  const actions: RosterAction[] = [];

  for (const target of roster) {
    const user = byEmail.get(target.email.toLowerCase());
    if (!user) {
      actions.push({ kind: 'create', target });
      continue;
    }
    const changes: string[] = [];
    if (user.name !== target.name) changes.push(`name ${user.name} → ${target.name}`);
    if (user.role !== target.role) changes.push(`role ${user.role} → ${target.role}`);
    if (!user.active) changes.push('active false → true');
    const pmAuthorized = target.capabilities.includes('MECHANIC_PM');
    if (user.pmAuthorized !== pmAuthorized) changes.push(`pmAuthorized ${user.pmAuthorized} → ${pmAuthorized}`);
    if (!sameSet(user.capabilities, target.capabilities)) {
      changes.push(`capabilities [${[...user.capabilities].sort().join(', ')}] → [${[...target.capabilities].sort().join(', ')}]`);
    }
    actions.push(changes.length ? { kind: 'update', userId: user.id, target, changes } : { kind: 'keep', userId: user.id, target });
  }

  const blockers: RosterPlan['blockers'] = [];
  for (const user of users) {
    if (keepEmails.has(user.email.trim().toLowerCase())) continue;
    if (!user.active) {
      actions.push({ kind: 'already_inactive', user });
      continue;
    }
    actions.push({ kind: 'deactivate', user });
    if (user.openWork.length) blockers.push({ email: user.email, openWork: user.openWork });
  }

  const pendingChanges = actions.filter((action) => action.kind === 'create' || action.kind === 'update' || action.kind === 'deactivate').length;
  return { actions, blockers, pendingChanges };
}
