/**
 * D36: the demo accounts (apps/api/prisma/seed.ts) in the order the panel shows them, with the one-line hint
 * the presenter reads before switching. Which accounts exist comes from the API; this is only narrative.
 */
export type DemoUserKey =
  | 'manager'
  | 'admin'
  | 'anthony'
  | 'elliot'
  | 'john'
  | 'alejandro1'
  | 'alejandro2'
  | 'daniel'
  | 'safety1'
  | 'safety2';

export type DemoCastGroup = 'Management' | 'Mechanics' | 'PM' | 'Safety';

export type DemoCastMember = {
  key: DemoUserKey;
  email: string;
  label: string;
  group: DemoCastGroup;
  hint: string;
};

export const DEMO_CAST: readonly DemoCastMember[] = [
  { key: 'manager', email: 'manager@lightning.local', label: 'Shop Manager', group: 'Management', hint: 'Dashboard, Yard, Work Orders, Parts & costs, Setup' },
  { key: 'admin', email: 'admin@lightning.local', label: 'System Admin', group: 'Management', hint: 'Everything the Manager has; corrects time and history' },
  { key: 'anthony', email: 'anthony@lightning.local', label: 'Anthony', group: 'Mechanics', hint: 'Clock running on 604; team queue' },
  { key: 'elliot', email: 'elliot@lightning.local', label: 'Elliot', group: 'Mechanics', hint: 'Blocked Job on 605, waiting for parts' },
  { key: 'john', email: 'john@lightning.local', label: 'John', group: 'Mechanics', hint: 'Clock left running yesterday on 944' },
  { key: 'alejandro1', email: 'mechanic@lightning.local', label: 'Alejandro 1', group: 'Mechanics', hint: 'Alignment; 603 ready to start' },
  { key: 'alejandro2', email: 'alejandro-2@lightning.local', label: 'Alejandro 2', group: 'Mechanics', hint: 'Detailing; helper on 612; team queue' },
  { key: 'daniel', email: 'daniel@lightning.local', label: 'Daniel', group: 'PM', hint: 'PM in progress on 968' },
  { key: 'safety1', email: 'safety-1@lightning.local', label: 'Safety 1', group: 'Safety', hint: 'To review: 616 first; returned 922' },
  { key: 'safety2', email: 'safety-2@lightning.local', label: 'Safety 2', group: 'Safety', hint: 'Took 905 for review' },
];

export const DEMO_CAST_GROUPS: readonly DemoCastGroup[] = ['Management', 'Mechanics', 'PM', 'Safety'];

export function castMember(key: DemoUserKey): DemoCastMember {
  const member = DEMO_CAST.find((item) => item.key === key);
  if (!member) throw new Error(`Unknown demo user ${key}`);
  return member;
}

export function castMemberByEmail(email: string | null | undefined): DemoCastMember | null {
  const needle = email?.trim().toLowerCase();
  return needle ? DEMO_CAST.find((item) => item.email === needle) ?? null : null;
}
