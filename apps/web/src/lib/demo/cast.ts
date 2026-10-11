import { DEMO_ROSTER, type DemoRosterCode } from '@ltl-shop/shared';

/**
 * D36: the demo accounts the panel can switch to, with the one-line hint the presenter reads before switching.
 * The accounts themselves come from packages/shared (demo-roster.ts) and are created by the demo build;
 * which ones exist comes from the API. This is only narrative.
 */
export type DemoUserKey = Exclude<DemoRosterCode, 'MG4'>;

export type DemoCastGroup = 'Management' | 'Mechanics' | 'PM' | 'Quality Check';

export type DemoCastMember = {
  key: DemoUserKey;
  email: string;
  /** The role code: what the audience sees everywhere ("MG1"). */
  label: string;
  /** The role in the shop's words ("Mecánico General"). */
  roleLabel: string;
  group: DemoCastGroup;
  hint: string;
};

const GROUPS: Record<DemoUserKey, DemoCastGroup> = {
  MS: 'Management', AS: 'Management', MG1: 'Mechanics', MG2: 'Mechanics', MG3: 'Mechanics', MA: 'Mechanics', MD: 'Mechanics', MPM: 'PM', QC1: 'Quality Check', QC2: 'Quality Check',
};

const HINTS: Record<DemoUserKey, string> = {
  MS: 'Dashboard, Yard, Work Orders, Parts & costs, Setup',
  AS: 'Everything the Manager has; corrects time and history',
  MG1: 'Clock running on 604; team queue',
  MG2: 'Blocked Job on 605, waiting for parts',
  MG3: 'Clock left running yesterday on 944',
  MA: 'Alignment; 603 ready to start',
  MD: 'Detailing; helper on 612; team queue',
  MPM: 'PM in progress on 968',
  QC1: 'To review: 616 first; returned 922',
  QC2: 'Took 905 for review',
};

export const DEMO_CAST: readonly DemoCastMember[] = DEMO_ROSTER.filter((row) => row.active).map((row) => ({
  key: row.code as DemoUserKey,
  email: row.email,
  label: row.code,
  roleLabel: row.roleLabel,
  group: GROUPS[row.code as DemoUserKey],
  hint: HINTS[row.code as DemoUserKey],
}));

export const DEMO_CAST_GROUPS: readonly DemoCastGroup[] = ['Management', 'Mechanics', 'PM', 'Quality Check'];

export function castMember(key: DemoUserKey): DemoCastMember {
  const member = DEMO_CAST.find((item) => item.key === key);
  if (!member) throw new Error(`Unknown demo user ${key}`);
  return member;
}

export function castMemberByEmail(email: string | null | undefined): DemoCastMember | null {
  const needle = email?.trim().toLowerCase();
  return needle ? DEMO_CAST.find((item) => item.email === needle) ?? null : null;
}
