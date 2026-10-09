import { AppCapability, PrismaClient } from '@prisma/client';
import { applyJobCatalog } from './job-catalog';
import { applyPmParts } from './pm-parts';
import { applyShopWorkflowSteps } from './shop-workflow-steps';

const prisma = new PrismaClient();

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
    { email: 'cristian@ltransl.com', name: 'Cristian' },
    // LTR-185 / D19: Safety does the Quality Check.
    { email: 'safety-1@lightning.local', name: 'Safety 1' },
    { email: 'safety-2@lightning.local', name: 'Safety 2' },
  ];
  for (const additionalMechanic of additionalMechanics) {
    await prisma.user.upsert({
      where: { email: additionalMechanic.email },
      update: {
        name: additionalMechanic.name,
        role: 'mechanic',
        active: true,
      },
      create: {
        ...additionalMechanic,
        role: 'mechanic',
        active: true,
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

  const multiWorkspaceAdmins = [
    { email: 'ibrain@ltransl.com', name: 'iBrain Admin' },
    { email: 'cristian240588@hotmail.com', name: 'Cristian Perez' },
  ];
  for (const multiWorkspaceAdmin of multiWorkspaceAdmins) {
    await prisma.user.upsert({
      where: { email: multiWorkspaceAdmin.email },
      update: { role: 'admin', active: true },
      create: {
        ...multiWorkspaceAdmin,
        role: 'admin',
        active: true,
      },
    });
  }

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

  const capabilityPlan: Array<{ email: string; capabilities: AppCapability[] }> = [
    { email: 'mechanic@lightning.local', capabilities: [AppCapability.MECHANIC_STANDARD] },
    { email: 'anthony@lightning.local', capabilities: [AppCapability.MECHANIC_STANDARD] },
    { email: 'alejandro-2@lightning.local', capabilities: [AppCapability.MECHANIC_STANDARD] },
    { email: 'john@lightning.local', capabilities: [AppCapability.MECHANIC_STANDARD] },
    { email: 'elliot@lightning.local', capabilities: [AppCapability.MECHANIC_STANDARD] },
    { email: 'cristian@ltransl.com', capabilities: [AppCapability.MECHANIC_STANDARD] },
    { email: 'daniel@lightning.local', capabilities: [AppCapability.MECHANIC_PM] },
    { email: 'safety-1@lightning.local', capabilities: [AppCapability.QUALITY_CHECK_PERFORM] },
    { email: 'safety-2@lightning.local', capabilities: [AppCapability.QUALITY_CHECK_PERFORM] },
    {
      email: 'manager@lightning.local',
      capabilities: [
        AppCapability.ADMIN_ACCESS,
        AppCapability.YARD_OPERATIONS_MANAGE,
        AppCapability.WORK_ORDERS_MANAGE,
      ],
    },
    {
      email: 'admin@lightning.local',
      capabilities: [
        AppCapability.ADMIN_ACCESS,
        AppCapability.YARD_OPERATIONS_MANAGE,
        AppCapability.WORK_ORDERS_MANAGE,
      ],
    },
    {
      email: 'ibrain@ltransl.com',
      capabilities: [
        AppCapability.ADMIN_ACCESS,
        AppCapability.MECHANIC_STANDARD,
        AppCapability.MECHANIC_PM,
      ],
    },
    {
      email: 'cristian240588@hotmail.com',
      capabilities: [
        AppCapability.ADMIN_ACCESS,
        AppCapability.MECHANIC_STANDARD,
        AppCapability.MECHANIC_PM,
      ],
    },
  ];
  for (const entry of capabilityPlan) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: entry.email } });
    await prisma.userCapability.deleteMany({ where: { userId: user.id } });
    await prisma.userCapability.createMany({
      data: entry.capabilities.map((capability) => ({ userId: user.id, capability })),
    });
  }

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
    // Enough trucks for the demo Work Orders (prisma/reset-demo-work-orders.ts, one scenario per truck).
    { truckNumber: '931', make: 'Volvo', model: 'VNL 760', year: 2022, mileage: 305400, company: 'Lightning', owner: 'Ana' },
    { truckNumber: '944', make: 'Freightliner', model: 'Cascadia', year: 2024, mileage: 121800, company: 'Lightning', owner: 'Pedro' },
    { truckNumber: '957', make: 'Kenworth', model: 'T680', year: 2023, mileage: 187250, company: 'Lightning', owner: 'Sofia' },
    { truckNumber: '973', make: 'Volvo', model: 'VNL 860', year: 2025, mileage: 64300, company: 'Lightning', owner: 'Jorge' },
    { truckNumber: '986', make: 'Freightliner', model: 'Cascadia', year: 2022, mileage: 356900, company: 'Lightning', owner: 'Lucia' },
    { truckNumber: '991', make: 'Kenworth', model: 'T680', year: 2024, mileage: 142000, company: 'Lightning', owner: 'Mateo' },
  ];

  for (const t of trucks) {
    await prisma.truck.upsert({
      where: { truckNumber: t.truckNumber },
      update: t,
      create: t,
    });
  }

  const catalog = await applyJobCatalog(prisma, { createdById: mechanic.id });
  const shopWorkflowSteps = await applyShopWorkflowSteps(prisma);
  // LTR-197 / D-SET7: Quality Check's team is every active Safety person (the migration does the same once).
  const qualityCheckStep = await prisma.shopWorkflowStep.findUnique({ where: { stepKey: 'quality_check' }, select: { id: true } });
  if (qualityCheckStep) {
    const safetyPeople = await prisma.user.findMany({
      where: { active: true, capabilities: { some: { capability: 'QUALITY_CHECK_PERFORM' } } },
      select: { id: true },
    });
    await prisma.shopWorkflowStepMember.createMany({
      data: safetyPeople.map((person) => ({ stepId: qualityCheckStep.id, userId: person.id })),
      skipDuplicates: true,
    });
  }

  const pmParts = await applyPmParts(prisma);

  console.log('Seed complete', {
    mechanic: mechanic.email,
    mechanic2: mechanic2.email,
    additionalMechanics: additionalMechanics.length,
    multiWorkspaceAdmins: multiWorkspaceAdmins.map(({ email }) => email),
    trucks: trucks.map((t) => t.truckNumber),
    categories: catalog.categories,
    catalogJobs: catalog.catalogJobs,
    shopWorkflowSteps,
    pmParts,
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
