import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function norm(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const PM_PARTS: Array<{ category: string; partNumber: string; displayName: string; makes?: string[] }> = [
  { category: 'Oil Filter 1 Unit', partNumber: '2234788', displayName: 'PETERBILT Oil Filter Paccar', makes: ['Peterbilt'] },
  { category: 'Oil Filter 1 Unit', partNumber: '5575298', displayName: 'PETERBILT Oil Filter Cummins', makes: ['Peterbilt'] },
  { category: 'Oil Filter 1 Unit', partNumber: 'B40145', displayName: 'PETERBILT Oil Filter Cummins', makes: ['Peterbilt'] },
  { category: 'Oil Filter 1 Unit', partNumber: 'WIX WL10107', displayName: 'PETERBILT Oil Filter Cummins', makes: ['Peterbilt'] },
  { category: 'Oil Filter 1 Unit', partNumber: 'WIX WL10341', displayName: 'PETERBILT Oil Filter', makes: ['Peterbilt'] },
  { category: 'Fuel Filter', partNumber: '2323323', displayName: 'PETERBILT Fuel Filter Paccar', makes: ['Peterbilt'] },
  { category: 'Fuel Filter', partNumber: '2242964', displayName: 'PETERBILT Fuel Filter Paccar', makes: ['Peterbilt'] },
  { category: 'Fuel Filter', partNumber: '5575143', displayName: 'PETERBILT Fuel Filter Cummins', makes: ['Peterbilt'] },
  { category: 'Fuel Filter', partNumber: 'BF46129', displayName: 'PETERBILT Fuel Filter Cummins', makes: ['Peterbilt'] },
  { category: 'Fuel Filter', partNumber: 'WIX WF10755', displayName: 'Large PETERBILT Fuel Filter Premium', makes: ['Peterbilt'] },
  { category: 'Fuel Filter', partNumber: 'WIX WF10755', displayName: 'Short PETERBILT Fuel Filter Premium', makes: ['Peterbilt'] },
  { category: 'Fuel Filter', partNumber: 'WF10515', displayName: 'PETERBILT Fuel Filter Cummins', makes: ['Peterbilt'] },
  { category: 'Paper Fuel Filter', partNumber: 'K37-1021', displayName: 'PETERBILT Paper Fuel Filter', makes: ['Peterbilt'] },
  { category: 'Paper Fuel Filter', partNumber: 'PF46236', displayName: 'PETERBILT Paper Fuel Filter', makes: ['Peterbilt'] },
  { category: 'Paper Fuel Filter', partNumber: 'L9765FXL', displayName: 'LUBER-FINER Fuel Filter PETERBILT', makes: ['Peterbilt'] },
  { category: 'Paper Fuel Filter', partNumber: 'WF10005', displayName: 'Paper Fuel Filter PETERBILT - Volvo', makes: ['Peterbilt', 'Volvo'] },
  { category: 'Paper Fuel Filter', partNumber: 'WF10566', displayName: 'PETERBILT Paper Filter', makes: ['Peterbilt'] },
  { category: 'Paper Fuel Filter', partNumber: 'P550851', displayName: 'Paper Fuel Filter PETERBILT - Volvo', makes: ['Peterbilt', 'Volvo'] },
  { category: 'Cabin Air Filter', partNumber: 'PA30093', displayName: 'PETERBILT Cabin Air Filter', makes: ['Peterbilt'] },
  { category: 'Cabin Air Filter', partNumber: 'CY08221P', displayName: 'PETERBILT Air Cabin Filter', makes: ['Peterbilt'] },
  { category: 'Cabin Air Filter', partNumber: 'WIX-24479', displayName: 'PETERBILT Air Cabin Filter', makes: ['Peterbilt'] },
  { category: 'Desiccant Filter', partNumber: '21620181', displayName: 'Desiccant and Oil Separator' },
  { category: 'Desiccant Filter', partNumber: '23099526', displayName: 'Desiccant Filter' },
  { category: 'Desiccant Filter', partNumber: '85115361', displayName: 'Desiccant Filter' },
  { category: 'Desiccant Filter', partNumber: 'P584764', displayName: 'PETERBILT DONALDSON', makes: ['Peterbilt'] },
  { category: 'Desiccant Filter', partNumber: '5009041PG', displayName: 'PETERBILT BENDIX', makes: ['Peterbilt'] },
  { category: 'Desiccant Filter', partNumber: 'BENP584764', displayName: 'Air Dryer Filter' },
  { category: 'Desiccant Filter', partNumber: 'WAB4324219222', displayName: 'Air Dryer Filter' },
  { category: 'Desiccant Filter', partNumber: 'WAB4329012382', displayName: 'Air Dryer Filter' },
  { category: 'Desiccant Filter', partNumber: 'WIX 24374', displayName: 'Desiccant Filter' },
  { category: 'Engine Air Filter', partNumber: '21715813', displayName: 'FILTER AIR C/P VN', makes: ['Volvo'] },
  { category: 'Engine Air Filter', partNumber: 'LAF9201', displayName: 'Air Filter' },
  { category: 'Engine Air Filter', partNumber: 'D37-1061', displayName: 'PETERBILT Engine Air Filter', makes: ['Peterbilt'] },
  { category: 'Engine Air Filter', partNumber: '25100042', displayName: 'Mack Engine Air Filter', makes: ['Mack'] },
  { category: 'Engine Air Filter', partNumber: 'WX49126', displayName: 'Engine Air Filter' },
  { category: 'Engine Air Filter', partNumber: 'WBX42808', displayName: 'Mack Engine Air Filter', makes: ['Mack'] },
  { category: 'Engine Air Filter', partNumber: 'DTP 03-42776-010', displayName: 'Freightliner Engine Air Filter Detroit', makes: ['Freightliner'] },
  { category: 'Wiper Blades', partNumber: 'MV31520B', displayName: 'WIPER BLADES' },
  { category: 'Wiper Blades', partNumber: 'MV31522B', displayName: 'Wiper Blades' },
  { category: 'Wiper Blades', partNumber: 'MV31524B', displayName: 'Wipers' },
  { category: 'Wiper Blades', partNumber: 'ANC31-22', displayName: 'Wiper Blades' },
  { category: 'Coolant Filter', partNumber: '21937327', displayName: 'COOLANT FILTER' },
  { category: 'Coolant Filter', partNumber: 'LFW5141', displayName: 'FILTER COOLANT' },
  { category: 'Coolant Filter', partNumber: 'DBC4086', displayName: 'FILTER COOLANT' },
];

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

  const partCategoryNames = [
    'Oil Filter 1 Unit', 'Oil Filter 2 Unit', 'Fuel Filter', 'Paper Fuel Filter',
    'Cabin Air Filter', 'Desiccant Filter', 'Engine Air Filter', 'Wiper Blades', 'Coolant Filter',
  ];
  const partCategories: Record<string, string> = {};
  for (let index = 0; index < partCategoryNames.length; index += 1) {
    const name = partCategoryNames[index];
    const category = await prisma.partCategory.upsert({
      where: { name },
      update: { sortOrder: index, active: true, aliases: name === 'Paper Fuel Filter' ? ['Papel Fuel Filter'] : [] },
      create: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), sortOrder: index, aliases: name === 'Paper Fuel Filter' ? ['Papel Fuel Filter'] : [] },
    });
    partCategories[name] = category.id;
  }
  const partsToSeed = [
    ...PM_PARTS,
    ...PM_PARTS.filter((part) => part.category === 'Oil Filter 1 Unit').map((part) => ({ ...part, category: 'Oil Filter 2 Unit' })),
  ];
  for (const item of partsToSeed) {
    const part = await prisma.part.upsert({
      where: { categoryId_partNumber_displayName: { categoryId: partCategories[item.category], partNumber: item.partNumber, displayName: item.displayName } },
      update: { active: true },
      create: { categoryId: partCategories[item.category], partNumber: item.partNumber, displayName: item.displayName },
    });
    await prisma.partFitment.deleteMany({ where: { partId: part.id } });
    if (item.makes?.length) await prisma.partFitment.createMany({ data: item.makes.map((make) => ({ partId: part.id, make })) });
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
