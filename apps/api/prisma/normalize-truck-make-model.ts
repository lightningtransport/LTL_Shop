import { PrismaClient } from '@prisma/client';
import { normalizeMakeModel } from '@ltl-shop/shared';

/**
 * LTR-113: puts Make / Model of the trucks already saved through the same rule the
 * Ninox import, Samsara connect and the truck form now use. Lists the changes only;
 * `--apply` writes them. Deactivated trucks are included (their history shows them).
 */
const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  const trucks = await prisma.truck.findMany({ select: { id: true, truckNumber: true, make: true, model: true }, orderBy: { truckNumber: 'asc' } });
  const changes = trucks
    .map((truck) => ({ truck, next: normalizeMakeModel(truck.make, truck.model) }))
    .filter(({ truck, next }) => next.make !== truck.make || next.model !== truck.model);

  for (const { truck, next } of changes) {
    console.log(`${truck.truckNumber}: ${truck.make ?? '—'} / ${truck.model ?? '—'}  →  ${next.make ?? '—'} / ${next.model ?? '—'}`);
  }
  console.log(`${changes.length} of ${trucks.length} trucks change.${apply ? '' : ' Nothing written; run with --apply to save.'}`);
  if (!apply || !changes.length) return;

  await prisma.$transaction(changes.map(({ truck, next }) => prisma.truck.update({ where: { id: truck.id }, data: next })));
  console.log('Saved.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
