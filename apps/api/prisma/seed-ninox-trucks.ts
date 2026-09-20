import { PrismaClient } from '@prisma/client';
import {
  getNinoxReadOnlyConfig,
  NinoxReadOnlyClient,
} from '../src/integrations/ninox/ninox.read-only-client';
import { runNinoxTruckSeed } from '../src/integrations/ninox/ninox-truck-seed';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const allowRerun = process.env.NINOX_TRUCK_SEED_ALLOW_RERUN === '1';
  const client = new NinoxReadOnlyClient(getNinoxReadOnlyConfig());
  const result = await runNinoxTruckSeed({ prisma, client, dryRun, allowRerun });
  console.log(JSON.stringify(result));
  if (result.status === 'already-completed') {
    console.error('Ninox truck seed already completed. Not querying Ninox again.');
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
