import { PrismaClient } from '@prisma/client';
import { loadCanonicalPmParts, PM_PART_CATEGORIES } from './pm-parts';

const prisma = new PrismaClient();

function norm(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const mechanic = await prisma.user.upsert({
    where: { email: 'mechanic@lightning.local' },
    update: {},
    create: {
      email: 'mechanic@lightning.local',
      name: 'Alejandro 1',
      role: 'mechanic',
      active: true,
    },
  });

  const mechanic2 = await prisma.user.upsert({
    where: { email: 'anthony@lightning.local' },
    update: {},
    create: {
      email: 'anthony@lightning.local',
      name: 'Anthony',
      role: 'mechanic',
      active: true,
    },
  });

  const additionalMechanics = [
    { email: 'alejandro-2@lightning.local', name: 'Alejandro 2' },
    { email: 'john@lightning.local', name: 'John' },
    { email: 'daniel@lightning.local', name: 'Daniel' },
    { email: 'elliot@lightning.local', name: 'Elliot' },
  ];
  for (const additionalMechanic of additionalMechanics) {
    await prisma.user.upsert({
      where: { email: additionalMechanic.email },
      update: {
        name: additionalMechanic.name,
        role: 'mechanic',
        active: true,
        pmAuthorized: additionalMechanic.name === 'Daniel',
      },
      create: {
        ...additionalMechanic,
        role: 'mechanic',
        active: true,
        pmAuthorized: additionalMechanic.name === 'Daniel',
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'manager@lightning.local' },
    update: {},
    create: {
      email: 'manager@lightning.local',
      name: 'Shop Manager',
      role: 'manager',
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@lightning.local' },
    update: {},
    create: {
      email: 'admin@lightning.local',
      name: 'Shop Administrator',
      role: 'admin',
      active: true,
    },
  });

  const trucks = [
    {
      truckNumber: '905',
      make: 'Volvo',
      model: 'VNL 860',
      year: 2025,
      mileage: 142500,
      company: 'Lightning',
      owner: 'Carlos',
    },
    {
      truckNumber: '968',
      make: 'Freightliner',
      model: 'Cascadia',
      year: 2023,
      mileage: 210000,
      company: 'Lightning',
      owner: 'Maria',
    },
    {
      truckNumber: '922',
      make: 'Kenworth',
      model: 'T680',
      year: 2024,
      mileage: 98000,
      company: 'Lightning',
      owner: 'Luis',
    },
  ];

  for (const t of trucks) {
    await prisma.truck.upsert({
      where: { truckNumber: t.truckNumber },
      update: t,
      create: t,
    });
  }

  const categories = [
    'PM',
    'Suspension',
    'Brakes',
    'Electrical',
    'Engine',
    'Alignment',
    'Air System',
    'Tires',
    'Transmission',
    'Other',
  ];

  const categoryIds: Record<string, string> = {};
  for (let i = 0; i < categories.length; i++) {
    const name = categories[i];
    const row = await prisma.jobCategory.upsert({
      where: { name },
      update: { sortOrder: i, status: 'active' },
      create: { name, sortOrder: i, status: 'active' },
    });
    categoryIds[name] = row.id;
  }

  const catalog: { category: string; name: string; aliases?: string[] }[] = [
    {
      category: 'Suspension',
      name: 'Suspension Inspection',
      aliases: ['suspension inspect', 'inspect suspension'],
    },
    {
      category: 'Suspension',
      name: '3 in 1',
      aliases: ['3in1', '3-in-1', '3 in one', 'three in one'],
    },
    { category: 'Suspension', name: 'Air Bag Replacement' },
    { category: 'Suspension', name: 'Shock Replacement' },
    { category: 'Suspension', name: 'Leveling Valve' },
    { category: 'Suspension', name: 'Torque Rod' },
    { category: 'Air System', name: 'Inspect Air System' },
    { category: 'Air System', name: 'Replace Air Hose' },
    { category: 'Electrical', name: 'ABS Sensor Replacement' },
    { category: 'Brakes', name: 'Brake Inspection' },
    { category: 'PM', name: 'PM A Service' },
    { category: 'PM', name: 'PM B Service' },
    { category: 'Engine', name: 'Cooling System' },
  ];

  for (const item of catalog) {
    const existing = await prisma.catalogJob.findFirst({
      where: {
        displayName: item.name,
        categoryId: categoryIds[item.category],
      },
    });
    const job =
      existing ??
      (await prisma.catalogJob.create({
        data: {
          displayName: item.name,
          categoryId: categoryIds[item.category],
          status: 'active',
          createdById: mechanic.id,
        },
      }));

    const aliases = [item.name, ...(item.aliases ?? [])];
    for (const alias of aliases) {
      const aliasNorm = norm(alias);
      await prisma.jobAlias.upsert({
        where: { aliasNorm },
        update: { aliasText: alias, catalogJobId: job.id },
        create: {
          catalogJobId: job.id,
          aliasText: alias,
          aliasNorm,
        },
      });
    }
  }

  const partCategories: Record<string, string> = {};
  for (let index = 0; index < PM_PART_CATEGORIES.length; index += 1) {
    const sourceCategory = PM_PART_CATEGORIES[index];
    const { name } = sourceCategory;
    const category = await prisma.partCategory.upsert({
      where: { name },
      update: { sortOrder: index, active: true, aliases: [...sourceCategory.aliases] },
      create: { name, slug: sourceCategory.slug, sortOrder: index, aliases: [...sourceCategory.aliases] },
    });
    partCategories[name] = category.id;
  }
  const partsToSeed = loadCanonicalPmParts();
  await prisma.part.updateMany({
    where: { categoryId: { in: Object.values(partCategories) } },
    data: { active: false },
  });
  for (const item of partsToSeed) {
    const part = await prisma.part.upsert({
      where: { categoryId_partNumber_displayName: { categoryId: partCategories[item.category], partNumber: item.partNumber, displayName: item.displayName } },
      update: { active: true },
      create: { categoryId: partCategories[item.category], partNumber: item.partNumber, displayName: item.displayName },
    });
    await prisma.partFitment.deleteMany({ where: { partId: part.id } });
    if (item.fitments.length) await prisma.partFitment.createMany({ data: item.fitments.map((fitment) => ({ partId: part.id, ...fitment })) });
  }

  console.log('Seed complete', {
    mechanic: mechanic.email,
    mechanic2: mechanic2.email,
    additionalMechanics: additionalMechanics.length,
    trucks: trucks.map((t) => t.truckNumber),
    categories: categories.length,
    catalogJobs: catalog.length,
    pmParts: partsToSeed.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
