import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * LTR-24 Cristian / PD job catalog (2026-09-14).
 *
 * CRITICAL: JobCategory.name for Preventive Maintenance MUST stay exactly `PM`.
 * API and Admin UI detect PM with `category.name === 'PM'`. The longer EN/ES
 * labels live on `displayNameEn` / `displayNameEs` for a future Frontend map.
 * Schema has a single `name` column — do not write the long string into it.
 */
export const PM_CATEGORY_NAME = 'PM';

export type CatalogJobDefinition = {
  displayName: string;
  aliases: string[];
  /** Older display names treated as the same catalog job when remapping. */
  legacyNames?: string[];
};

export type CatalogCategoryDefinition = {
  name: string;
  sortOrder: number;
  /** CURRENT category names that remap into this row. */
  legacyNames: string[];
  /** PD-signed EN label. Equals `name` except PM (`Preventive Maintenance (PM)`). */
  displayNameEn: string;
  /** PD-signed ES label. Not stored — no category locale column. */
  displayNameEs: string;
  jobs: CatalogJobDefinition[];
};

export function normalizeCatalogAlias(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const JOB_CATALOG_CATEGORIES: CatalogCategoryDefinition[] = [
  {
    name: PM_CATEGORY_NAME,
    sortOrder: 0,
    legacyNames: [],
    displayNameEn: 'Preventive Maintenance (PM)',
    displayNameEs: 'Mantenimiento preventivo (PM)',
    jobs: [
      { displayName: 'PM A Service', aliases: ['PM A', 'servicio PM A'] },
      { displayName: 'PM B Service', aliases: ['PM B', 'servicio PM B'] },
      { displayName: 'Oil Change', aliases: ['oil', 'cambio de aceite'] },
      { displayName: 'Filter Service', aliases: ['filters', 'filtros'] },
      { displayName: 'Lubrication', aliases: ['lube', 'lubricación', 'lubricacion'] },
      { displayName: 'Scheduled Maintenance', aliases: ['mantenimiento programado'] },
    ],
  },
  {
    name: 'Inspection',
    sortOrder: 1,
    legacyNames: [],
    displayNameEn: 'Inspection',
    displayNameEs: 'Inspección',
    jobs: [
      { displayName: 'DOT Inspection', aliases: ['DOT', 'inspección DOT', 'inspeccion DOT'] },
      { displayName: 'Annual Inspection', aliases: ['inspección anual', 'inspeccion anual'] },
      { displayName: 'General Inspection', aliases: ['revisión general', 'revision general'] },
    ],
  },
  {
    name: 'Engine & Emissions',
    sortOrder: 2,
    legacyNames: ['Engine'],
    displayNameEn: 'Engine & Emissions',
    displayNameEs: 'Motor y emisiones',
    jobs: [
      { displayName: 'Engine Repair', aliases: ['motor', 'engine'] },
      { displayName: 'EGR Service', aliases: ['EGR'] },
      { displayName: 'Turbo Inspect', aliases: ['turbo'] },
      { displayName: 'Derate Diagnose', aliases: ['derate'] },
      { displayName: 'Engine Leak Repair', aliases: ['oil leak', 'engine leak', 'fuga de aceite'] },
      { displayName: 'Seal Replacement', aliases: ['seals', 'sellos'] },
      { displayName: 'DPF/DEF Service', aliases: ['DPF', 'DEF', 'DPF DEF'] },
    ],
  },
  {
    name: 'Fuel System',
    sortOrder: 3,
    legacyNames: [],
    displayNameEn: 'Fuel System',
    displayNameEs: 'Sistema de combustible',
    jobs: [
      { displayName: 'Fuel Tank', aliases: ['tanque de combustible'] },
      { displayName: 'Fuel Lines', aliases: ['líneas de combustible', 'lineas de combustible'] },
      { displayName: 'Fuel Filters', aliases: ['filtro de combustible'] },
      { displayName: 'Fuel Leak', aliases: ['fuga de combustible'] },
    ],
  },
  {
    name: 'Cooling System',
    sortOrder: 4,
    legacyNames: [],
    displayNameEn: 'Cooling System',
    displayNameEs: 'Sistema de enfriamiento',
    jobs: [
      { displayName: 'Cooling System', aliases: ['cooling', 'sistema de enfriamiento'] },
      { displayName: 'Coolant Service', aliases: ['coolant', 'refrigerante'] },
      { displayName: 'Radiator', aliases: ['radiador'] },
      { displayName: 'Expansion Tank', aliases: ['tanque de expansión', 'tanque de expansion'] },
      { displayName: 'Cooling Hoses', aliases: ['mangueras de enfriamiento'] },
    ],
  },
  {
    name: 'Electrical & Starting',
    sortOrder: 5,
    legacyNames: ['Electrical'],
    displayNameEn: 'Electrical & Starting',
    displayNameEs: 'Eléctrico y arranque',
    jobs: [
      { displayName: 'Battery', aliases: ['batería', 'bateria'] },
      { displayName: 'Alternator', aliases: ['alternador'] },
      { displayName: 'Starter', aliases: ['marcha', 'arrancador'] },
      { displayName: 'Wiring', aliases: ['cableado'] },
      { displayName: 'Lights', aliases: ['luces'] },
      { displayName: 'ABS Electrical', aliases: ['ABS'] },
      { displayName: 'ABS Sensor Replacement', aliases: ['ABS sensor'] },
      { displayName: "Truck Won't Start", aliases: ['no start', 'no arranca'] },
    ],
  },
  {
    name: 'Air & Brake System',
    sortOrder: 6,
    legacyNames: ['Brakes', 'Air System'],
    displayNameEn: 'Air & Brake System',
    displayNameEs: 'Aire y frenos',
    jobs: [
      { displayName: 'Brake Inspection', aliases: ['brakes', 'frenos'] },
      { displayName: 'Brake Chambers', aliases: ['chambers', 'cámaras de freno', 'camaras de freno'] },
      { displayName: 'Inspect Air System', aliases: ['air system'] },
      { displayName: 'Replace Air Hose', aliases: ['air hose'] },
      { displayName: 'Air Lines', aliases: ['líneas de aire', 'lineas de aire'] },
      { displayName: 'Air Leak', aliases: ['fuga de aire'] },
      { displayName: 'Air Dryer', aliases: ['secador de aire'] },
      { displayName: 'Valves', aliases: ['válvulas', 'valvulas'] },
    ],
  },
  {
    name: 'Suspension & Steering',
    sortOrder: 7,
    legacyNames: ['Suspension', 'Alignment'],
    displayNameEn: 'Suspension & Steering',
    displayNameEs: 'Suspensión y dirección',
    jobs: [
      {
        displayName: 'Suspension Inspection',
        aliases: ['suspension inspect', 'inspect suspension', 'suspensión', 'suspension'],
      },
      { displayName: '3 in 1', aliases: ['3in1', '3-in-1', '3 in one', 'three in one'] },
      { displayName: 'Air Bag Replacement', aliases: ['air bags', 'airbags', 'bolsas de aire'] },
      { displayName: 'Shock Replacement', aliases: ['shocks', 'amortiguadores'] },
      { displayName: 'Leveling Valve', aliases: ['leveling'] },
      { displayName: 'Torque Rod', aliases: [] },
      { displayName: 'Axle', aliases: ['eje'] },
      { displayName: 'Alignment', aliases: ['alineación', 'alineacion'] },
      { displayName: 'Steering', aliases: ['dirección', 'direccion'] },
    ],
  },
  {
    name: 'Transmission & Drivetrain',
    sortOrder: 8,
    legacyNames: ['Transmission'],
    displayNameEn: 'Transmission & Drivetrain',
    displayNameEs: 'Transmisión y tren motriz',
    jobs: [
      { displayName: 'Transmission', aliases: ['transmisión', 'transmision'] },
      { displayName: 'Clutch', aliases: ['clutching', 'embrague'] },
      { displayName: 'Differential', aliases: ['diferencial'] },
      { displayName: 'Driveshaft', aliases: ['cardán', 'cardan'] },
      { displayName: 'Axle Shaft', aliases: ['flecha'] },
      { displayName: '5th Wheel', aliases: ['fifth wheel', 'quinta rueda'] },
    ],
  },
  {
    name: 'Tires & Wheels',
    sortOrder: 9,
    legacyNames: ['Tires'],
    displayNameEn: 'Tires & Wheels',
    displayNameEs: 'Llantas y rines',
    jobs: [
      { displayName: 'Tires', aliases: ['llantas'] },
      { displayName: 'Rims', aliases: ['rines'] },
      { displayName: 'Flat Repair', aliases: ['flats', 'ponchadura'] },
      { displayName: 'Tire Rotation', aliases: ['rotación', 'rotacion'] },
      { displayName: 'Tire Mounting', aliases: ['mounting', 'montaje'] },
      { displayName: 'Hubs', aliases: ['mazas'] },
      { displayName: 'Wheel Seals', aliases: ['retén de rueda', 'reten de rueda'] },
    ],
  },
  {
    name: 'HVAC / A/C',
    sortOrder: 10,
    legacyNames: [],
    displayNameEn: 'HVAC / A/C',
    displayNameEs: 'Clima / A/C',
    jobs: [
      { displayName: 'A/C', aliases: ['AC', 'aire acondicionado'] },
      { displayName: 'Heater', aliases: ['heater', 'calefacción', 'calefaccion'] },
      { displayName: 'Blower Motor', aliases: ['blower'] },
      { displayName: 'Climate System', aliases: ['clima'] },
    ],
  },
  {
    name: 'Cab, Body & Glass',
    sortOrder: 11,
    legacyNames: [],
    displayNameEn: 'Cab, Body & Glass',
    displayNameEs: 'Cabina, carrocería y vidrios',
    jobs: [
      { displayName: 'Windshield', aliases: ['parabrisas'] },
      { displayName: 'Mirrors', aliases: ['espejos'] },
      { displayName: 'Doors', aliases: ['puertas'] },
      { displayName: 'Body Work', aliases: ['carrocería', 'carroceria'] },
      { displayName: 'Wipers', aliases: ['limpiaparabrisas'] },
      { displayName: 'Mudflaps', aliases: ['loderas'] },
    ],
  },
  {
    name: 'Trailer',
    sortOrder: 12,
    legacyNames: [],
    displayNameEn: 'Trailer',
    displayNameEs: 'Trailer',
    jobs: [
      { displayName: 'Trailer Repair', aliases: ['trailer', 'reparación de trailer', 'reparacion de trailer'] },
    ],
  },
  {
    name: 'Road Service & Towing',
    sortOrder: 13,
    legacyNames: [],
    displayNameEn: 'Road Service & Towing',
    displayNameEs: 'Servicio en ruta y grúa',
    jobs: [
      { displayName: 'Road Service', aliases: ['servicio en ruta'] },
      { displayName: 'Towing', aliases: ['grúa', 'grua'] },
      { displayName: 'Winch Out', aliases: ['winch'] },
      { displayName: 'Lockout', aliases: ['llaves', 'lock out'] },
    ],
  },
  {
    name: 'Other',
    sortOrder: 14,
    legacyNames: [],
    displayNameEn: 'Other',
    displayNameEs: 'Otro',
    jobs: [
      { displayName: 'Uncategorized', aliases: ['other', 'otro'] },
    ],
  },
];

const JOB_RELOCATIONS: Array<{ displayName: string; toCategory: string }> = [
  { displayName: 'Cooling System', toCategory: 'Cooling System' },
];

export function listCatalogJobAliasTexts(job: CatalogJobDefinition) {
  return [job.displayName, ...job.aliases];
}

export function flattenCatalogAliasNorms() {
  return JOB_CATALOG_CATEGORIES.flatMap((category) =>
    category.jobs.flatMap((job) => listCatalogJobAliasTexts(job).map(normalizeCatalogAlias)),
  );
}

type JobCatalogClient = PrismaClient | Prisma.TransactionClient;

export async function applyJobCatalog(
  prisma: JobCatalogClient,
  options: { createdById?: string } = {},
) {
  const categoryIds = await upsertCatalogCategories(prisma);

  for (const relocation of JOB_RELOCATIONS) {
    const destinationId = categoryIds[relocation.toCategory];
    if (!destinationId) continue;
    await prisma.catalogJob.updateMany({
      where: { displayName: relocation.displayName, categoryId: { not: destinationId } },
      data: { categoryId: destinationId, status: 'active' },
    });
  }

  let jobCount = 0;
  for (const category of JOB_CATALOG_CATEGORIES) {
    const categoryId = categoryIds[category.name];
    for (const item of category.jobs) {
      const job = await upsertCatalogJob(prisma, {
        categoryId,
        item,
        createdById: options.createdById,
      });
      jobCount += 1;
      for (const alias of listCatalogJobAliasTexts(item)) {
        const aliasNorm = normalizeCatalogAlias(alias);
        await prisma.jobAlias.upsert({
          where: { aliasNorm },
          update: { aliasText: alias, catalogJobId: job.id },
          create: { catalogJobId: job.id, aliasText: alias, aliasNorm },
        });
      }
    }
  }

  return {
    categories: JOB_CATALOG_CATEGORIES.length,
    catalogJobs: jobCount,
    categoryIds,
  };
}

async function upsertCatalogCategories(prisma: JobCatalogClient) {
  const categoryIds: Record<string, string> = {};

  for (const category of JOB_CATALOG_CATEGORIES) {
    const names = [category.name, ...category.legacyNames];
    const matches = await prisma.jobCategory.findMany({
      where: { name: { in: names } },
      orderBy: { createdAt: 'asc' },
    });
    const winner =
      matches.find((row) => row.name === category.name) ?? matches[0] ?? null;

    const row = winner
      ? await prisma.jobCategory.update({
          where: { id: winner.id },
          data: { name: category.name, sortOrder: category.sortOrder, status: 'active' },
        })
      : await prisma.jobCategory.create({
          data: { name: category.name, sortOrder: category.sortOrder, status: 'active' },
        });

    const losers = matches.filter((match) => match.id !== row.id);
    if (losers.length) {
      const loserIds = losers.map((loser) => loser.id);
      await prisma.workOrder.updateMany({
        where: { primaryCategoryId: { in: loserIds } },
        data: { primaryCategoryId: row.id },
      });
      await prisma.workOrderJob.updateMany({
        where: { categoryId: { in: loserIds } },
        data: { categoryId: row.id },
      });
      await prisma.catalogJob.updateMany({
        where: { categoryId: { in: loserIds } },
        data: { categoryId: row.id },
      });
      await prisma.jobCategory.updateMany({
        where: { id: { in: loserIds } },
        data: { status: 'inactive' },
      });
    }

    categoryIds[category.name] = row.id;
  }

  return categoryIds;
}

async function upsertCatalogJob(
  prisma: JobCatalogClient,
  input: { categoryId: string; item: CatalogJobDefinition; createdById?: string },
) {
  const names = [input.item.displayName, ...(input.item.legacyNames ?? [])];
  const existing = await prisma.catalogJob.findFirst({
    where: {
      categoryId: input.categoryId,
      displayName: { in: names },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    return prisma.catalogJob.update({
      where: { id: existing.id },
      data: { displayName: input.item.displayName, status: 'active' },
    });
  }

  return prisma.catalogJob.create({
    data: {
      displayName: input.item.displayName,
      categoryId: input.categoryId,
      status: 'active',
      createdById: input.createdById,
    },
  });
}
