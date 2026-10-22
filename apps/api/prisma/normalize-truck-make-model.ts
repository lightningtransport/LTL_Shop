import { PrismaClient } from '@prisma/client';
import { normalizeMakeModel } from '@ltl-shop/shared';

/**
 * LTR-113: puts Make / Model of the trucks already saved through the same rule the
 * Ninox import, Samsara connect and the truck form now use. Lists the changes only;
 * `--apply` writes them. Deactivated trucks are included (their history shows them).
 * LTR-277 §4: the parts' Fits go through the same rule, so the Fits filter has one Kenworth.
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
  console.log(`${changes.length} of ${trucks.length} trucks change.`);

  const fitments = await prisma.partFitment.findMany({
    select: { id: true, partId: true, make: true, model: true, part: { select: { displayName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  // A fit that becomes the same as another fit of its part is removed instead of saved twice.
  const kept = new Set<string>();
  const fitChanges: Array<{ fit: (typeof fitments)[number]; next: { make: string | null; model: string | null } }> = [];
  const fitDuplicates: Array<(typeof fitments)[number]> = [];
  for (const fit of fitments) {
    const next = normalizeMakeModel(fit.make, fit.model);
    const key = `${fit.partId}|${next.make ?? ''}|${next.model ?? ''}`.toLocaleLowerCase('en-US');
    if (kept.has(key)) fitDuplicates.push(fit);
    else {
      kept.add(key);
      if (next.make !== fit.make || next.model !== fit.model) fitChanges.push({ fit, next });
    }
  }
  for (const { fit, next } of fitChanges) {
    console.log(`Fits · ${fit.part.displayName}: ${fit.make ?? '—'} / ${fit.model ?? '—'}  →  ${next.make ?? '—'} / ${next.model ?? '—'}`);
  }
  for (const fit of fitDuplicates) {
    console.log(`Fits · ${fit.part.displayName}: ${fit.make ?? '—'} / ${fit.model ?? '—'}  →  removed (the part already fits it)`);
  }
  console.log(`${fitChanges.length} of ${fitments.length} part fits change, ${fitDuplicates.length} repeated.${apply ? '' : ' Nothing written; run with --apply to save.'}`);
  if (!apply || (!changes.length && !fitChanges.length && !fitDuplicates.length)) return;

  await prisma.$transaction([
    ...changes.map(({ truck, next }) => prisma.truck.update({ where: { id: truck.id }, data: next })),
    ...fitChanges.map(({ fit, next }) => prisma.partFitment.update({ where: { id: fit.id }, data: next })),
    ...(fitDuplicates.length ? [prisma.partFitment.deleteMany({ where: { id: { in: fitDuplicates.map((fit) => fit.id) } } })] : []),
  ]);
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
