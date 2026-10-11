import { AppCapability, UserRole } from './enums';

/**
 * D36 (2026-10-10): the accounts of the local demo, named by role the way the shop names them (the production
 * test roster already uses MG, MPM, MD, MA). The demo build (apps/api/prisma/reset-demo-work-orders.ts --demo)
 * renames the seed's person accounts to these; the Demo panel (apps/web/src/lib/demo/cast.ts) lists them.
 * The seed itself keeps the person names: the test database and the Playwright fixture depend on them.
 */
export type DemoRosterCode = 'MS' | 'AS' | 'MG1' | 'MG2' | 'MG3' | 'MA' | 'MD' | 'MPM' | 'QC1' | 'QC2' | 'MG4';

export type DemoRosterRow = {
  code: DemoRosterCode;
  /** Shown everywhere the app shows a person: header, avatars (initials = the code), lists. */
  name: string;
  /** Role words in Spanish: what the shop calls each profile. */
  roleLabel: string;
  email: string;
  /** The seed account this one replaces in the demo database. */
  seedEmail: string;
  role: UserRole;
  capabilities: AppCapability[];
  active: boolean;
};

const MANAGER_CAPABILITIES = [AppCapability.ADMIN_ACCESS, AppCapability.YARD_OPERATIONS_MANAGE, AppCapability.WORK_ORDERS_MANAGE];

export const DEMO_ROSTER: readonly DemoRosterRow[] = [
  { code: 'MS', name: 'MS · Manager Shop', roleLabel: 'Manager Shop', email: 'ms@lightning.local', seedEmail: 'manager@lightning.local', role: UserRole.MANAGER, capabilities: MANAGER_CAPABILITIES, active: true },
  { code: 'AS', name: 'AS · Admin Shop', roleLabel: 'Admin Shop', email: 'as@lightning.local', seedEmail: 'admin@lightning.local', role: UserRole.ADMIN, capabilities: MANAGER_CAPABILITIES, active: true },
  { code: 'MG1', name: 'MG1 · Mecánico General', roleLabel: 'Mecánico General', email: 'mg1@lightning.local', seedEmail: 'anthony@lightning.local', role: UserRole.MECHANIC, capabilities: [AppCapability.MECHANIC_STANDARD], active: true },
  { code: 'MG2', name: 'MG2 · Mecánico General', roleLabel: 'Mecánico General', email: 'mg2@lightning.local', seedEmail: 'elliot@lightning.local', role: UserRole.MECHANIC, capabilities: [AppCapability.MECHANIC_STANDARD], active: true },
  { code: 'MG3', name: 'MG3 · Mecánico General', roleLabel: 'Mecánico General', email: 'mg3@lightning.local', seedEmail: 'john@lightning.local', role: UserRole.MECHANIC, capabilities: [AppCapability.MECHANIC_STANDARD], active: true },
  { code: 'MA', name: 'MA · Mecánico Alineación', roleLabel: 'Mecánico Alineación', email: 'ma@lightning.local', seedEmail: 'mechanic@lightning.local', role: UserRole.MECHANIC, capabilities: [AppCapability.MECHANIC_STANDARD], active: true },
  { code: 'MD', name: 'MD · Mecánico Detailing', roleLabel: 'Mecánico Detailing', email: 'md@lightning.local', seedEmail: 'alejandro-2@lightning.local', role: UserRole.MECHANIC, capabilities: [AppCapability.MECHANIC_STANDARD], active: true },
  { code: 'MPM', name: 'MPM · Mecánico PM', roleLabel: 'Mecánico PM', email: 'mpm@lightning.local', seedEmail: 'daniel@lightning.local', role: UserRole.MECHANIC, capabilities: [AppCapability.MECHANIC_PM], active: true },
  { code: 'QC1', name: 'QC1 · Quality Check', roleLabel: 'Quality Check', email: 'qc1@lightning.local', seedEmail: 'safety-1@lightning.local', role: UserRole.MECHANIC, capabilities: [AppCapability.QUALITY_CHECK_PERFORM], active: true },
  { code: 'QC2', name: 'QC2 · Quality Check', roleLabel: 'Quality Check', email: 'qc2@lightning.local', seedEmail: 'safety-2@lightning.local', role: UserRole.MECHANIC, capabilities: [AppCapability.QUALITY_CHECK_PERFORM], active: true },
  // Inactive on purpose: shows the People filter (HU-M9). Created by the demo build, not by the seed.
  { code: 'MG4', name: 'MG4 · Mecánico General', roleLabel: 'Mecánico General', email: 'mg4@lightning.local', seedEmail: 'luis@lightning.local', role: UserRole.MECHANIC, capabilities: [AppCapability.MECHANIC_STANDARD], active: false },
];

export function demoRosterByCode(code: DemoRosterCode): DemoRosterRow {
  const row = DEMO_ROSTER.find((item) => item.code === code);
  if (!row) throw new Error(`Unknown demo roster code ${code}`);
  return row;
}

/** Avatar initials for a roster name: the code itself ("MG1 · Mecánico General" → "MG1"). */
export function demoRosterCodeOf(name: string): DemoRosterCode | null {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return DEMO_ROSTER.some((row) => row.code === first) ? (first as DemoRosterCode) : null;
}
