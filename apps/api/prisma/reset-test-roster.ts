/**
 * LTR-160: keep only the test roster active in production.
 *
 *   npm run prisma:reset-test-roster --workspace=@ltl-shop/api            # dry-run (default)
 *   npm run prisma:reset-test-roster --workspace=@ltl-shop/api -- --apply # writes, in one transaction
 *
 * The connection comes from apps/api/.env.production.local (gitignored). Users outside the roster are
 * deactivated, never deleted; their capabilities stay so they can be reactivated. Supabase Auth
 * accounts and passwords are managed in the Supabase dashboard, not here.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaClient, type AppCapability } from '@prisma/client';
import { planRosterReset, TEST_ROSTER, type RosterCapability, type RosterUser } from '../src/admin/test-roster-plan';

const envFile = resolve(__dirname, '../.env.production.local');
if (!existsSync(envFile)) {
  console.error(`Missing ${envFile}. Put the production DATABASE_URL (and DIRECT_URL) there.`);
  process.exit(1);
}
config({ path: envFile, override: true });

const OPEN_STATUSES = ['created', 'in_progress', 'waiting_paused'] as const;
const prisma = new PrismaClient();

async function loadUsers(): Promise<RosterUser[]> {
  const rows = await prisma.user.findMany({
    include: {
      capabilities: { select: { capability: true } },
      assignedJobs: {
        where: { status: 'to_do', workOrder: { status: { in: [...OPEN_STATUSES] } } },
        select: { displayName: true, workOrder: { select: { displayId: true } } },
      },
      mechanicAssignments: {
        where: { removedAt: null, workOrder: { status: { in: [...OPEN_STATUSES] } } },
        select: { workOrder: { select: { displayId: true } } },
      },
    },
    orderBy: { email: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    pmAuthorized: row.pmAuthorized,
    capabilities: row.capabilities.map((item) => item.capability as RosterCapability),
    openWork: [
      ...row.assignedJobs.map((job) => `${job.workOrder.displayId}: job "${job.displayName}" assigned`),
      ...row.mechanicAssignments.map((assignment) => `${assignment.workOrder.displayId}: on the team`),
    ],
  }));
}

async function main() {
  const apply = process.argv.includes('--apply');
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://unknown').hostname;
  console.log(`Database host: ${host}`);
  console.log(apply ? 'Mode: APPLY' : 'Mode: dry-run (pass --apply to write)');

  const users = await loadUsers();
  const plan = planRosterReset(users);

  for (const action of plan.actions) {
    switch (action.kind) {
      case 'create':
        console.log(`CREATE      ${action.target.email} · ${action.target.name} · ${action.target.role} · [${action.target.capabilities.join(', ')}]`);
        break;
      case 'update':
        console.log(`UPDATE      ${action.target.email} · ${action.changes.join('; ')}`);
        break;
      case 'keep':
        console.log(`OK          ${action.target.email}`);
        break;
      case 'deactivate':
        console.log(`DEACTIVATE  ${action.user.email} · ${action.user.name} · ${action.user.role}${action.user.openWork.length ? ` · OPEN WORK: ${action.user.openWork.join(', ')}` : ''}`);
        break;
      case 'already_inactive':
        console.log(`INACTIVE    ${action.user.email}`);
        break;
    }
  }
  console.log(`Pending changes: ${plan.pendingChanges}`);

  if (plan.blockers.length) {
    console.error('Refusing to continue: reassign the open work of these users first.');
    for (const blocker of plan.blockers) console.error(`  ${blocker.email}: ${blocker.openWork.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  if (!apply || plan.pendingChanges === 0) return;

  await prisma.$transaction(async (tx) => {
    const ids = new Map<string, string>();
    for (const target of TEST_ROSTER) {
      const data = { name: target.name, role: target.role, active: true, pmAuthorized: target.capabilities.includes('MECHANIC_PM') };
      const saved = await tx.user.upsert({ where: { email: target.email }, update: data, create: { email: target.email, ...data } });
      ids.set(target.email, saved.id);
    }
    const grantedById = ids.get(TEST_ROSTER[0].email) ?? null;
    for (const target of TEST_ROSTER) {
      const userId = ids.get(target.email)!;
      await tx.userCapability.deleteMany({ where: { userId, capability: { notIn: target.capabilities as AppCapability[] } } });
      for (const capability of target.capabilities) {
        await tx.userCapability.upsert({
          where: { userId_capability: { userId, capability: capability as AppCapability } },
          update: {},
          create: { userId, capability: capability as AppCapability, grantedById },
        });
      }
    }
    const deactivate = plan.actions.flatMap((action) => (action.kind === 'deactivate' ? [action.user.id] : []));
    if (deactivate.length) await tx.user.updateMany({ where: { id: { in: deactivate } }, data: { active: false } });
  }, { maxWait: 15_000, timeout: 60_000 }); // Remote pooler round-trips exceed Prisma's 5 s default.
  console.log('Applied. Run again without --apply to confirm there are no pending changes.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
