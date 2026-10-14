import { CatalogCategorySystemKey, CatalogSystemKey, normalizeCatalogText } from '@ltl-shop/shared';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * LTR-24 Cristian / PD job catalog (2026-09-14) plus LTR-35 Detailing and
 * LTR-41 Quality Check.
 *
 * CRITICAL: JobCategory.name for Preventive Maintenance MUST stay exactly `PM`.
 * API and Admin UI detect PM with `category.name === 'PM'`. The longer EN/ES
 * labels live on `displayNameEn` / `displayNameEs` for a future Frontend map.
 * Schema has a single `name` column — do not write the long string into it.
 *
 * LTR-35: category + job `Detailing` stay identical EN/ES (PO 2026-09-14).
 * LTR-41: category + job `Quality Check` stay identical EN/ES.
 * Catalog UUIDs are per-environment; Frontend should look up by these names:
 *   GET /api/catalog/categories → name === Detailing | Quality Check
 *   GET /api/catalog/jobs?categoryId= → displayName === Detailing | Quality Check
 */
export const PM_CATEGORY_NAME = 'PM';
export const DETAILING_CATEGORY_NAME = 'Detailing';
export const DETAILING_JOB_DISPLAY_NAME = 'Detailing';
export const QUALITY_CHECK_CATEGORY_NAME = 'Quality Check';
export const QUALITY_CHECK_JOB_DISPLAY_NAME = 'Quality Check';

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
  return normalizeCatalogText(text);
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
      // D41: fuel, washer fluid and other levels found low in the inspection.
      { displayName: 'Fluid Top-Off', aliases: ['top off', 'fluids', 'rellenar fluidos'] },
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
      { displayName: 'Derate Diagnose', aliases: ['derate', 'warning lights', 'check engine'] },
      { displayName: 'Engine Leak Repair', aliases: ['oil leak', 'engine leak', 'fuga de aceite'] },
      { displayName: 'Seal Replacement', aliases: ['seals', 'sellos'] },
      { displayName: 'DPF/DEF Service', aliases: ['DPF', 'DEF', 'DPF DEF'] },
      { displayName: 'Belts & Tensioners', aliases: ['belts', 'tensioners', 'bandas', 'tensores'] },
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
      { displayName: 'Wiring', aliases: ['cableado', 'fuses', 'fusibles'] },
      { displayName: 'Lights', aliases: ['luces'] },
      { displayName: 'ABS Electrical', aliases: ['ABS'] },
      { displayName: 'ABS Sensor Replacement', aliases: ['ABS sensor'] },
      { displayName: "Truck Won't Start", aliases: ['no start', 'no arranca'] },
      { displayName: 'Horn', aliases: ['bocina', 'claxon'] },
      { displayName: 'Radio & Phone', aliases: ['radio', 'cellphone', 'celular'] },
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
      { displayName: 'Parking Brake', aliases: ['freno de mano', 'freno de estacionamiento'] },
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
      { displayName: 'Differential', aliases: ['diferencial', 'breathers', 'rear end seals'] },
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
      { displayName: 'Body Work', aliases: ['carrocería', 'carroceria', 'deer guard', 'defensa'] },
      { displayName: 'Wipers', aliases: ['limpiaparabrisas'] },
      { displayName: 'Mudflaps', aliases: ['loderas'] },
      { displayName: 'Seats & Belts', aliases: ['seats', 'seat belts', 'asientos', 'cinturones'] },
      { displayName: 'Safety Equipment', aliases: ['fire extinguisher', 'extintor', 'triangles'] },
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
    name: DETAILING_CATEGORY_NAME,
    sortOrder: 14,
    legacyNames: [],
    displayNameEn: DETAILING_CATEGORY_NAME,
    displayNameEs: DETAILING_CATEGORY_NAME,
    jobs: [
      { displayName: DETAILING_JOB_DISPLAY_NAME, aliases: [] },
    ],
  },
  {
    name: QUALITY_CHECK_CATEGORY_NAME,
    sortOrder: 15,
    legacyNames: [],
    displayNameEn: QUALITY_CHECK_CATEGORY_NAME,
    displayNameEs: QUALITY_CHECK_CATEGORY_NAME,
    jobs: [
      {
        displayName: QUALITY_CHECK_JOB_DISPLAY_NAME,
        aliases: ['QC', 'quality_check', 'chequeo de calidad'],
      },
    ],
  },
  {
    name: 'Other',
    sortOrder: 16,
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
  { displayName: DETAILING_JOB_DISPLAY_NAME, toCategory: DETAILING_CATEGORY_NAME },
  { displayName: QUALITY_CHECK_JOB_DISPLAY_NAME, toCategory: QUALITY_CHECK_CATEGORY_NAME },
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

/** LTR-198 / D30: the System Jobs and Categories of the seed (found by key afterwards, never by name). */
const SYSTEM_JOB_KEYS: Record<string, string> = {
  'PM/PM A Service': CatalogSystemKey.PM_A,
  'PM/PM B Service': CatalogSystemKey.PM_B,
  'Suspension & Steering/Alignment': CatalogSystemKey.ALIGNMENT,
  [`${DETAILING_CATEGORY_NAME}/${DETAILING_JOB_DISPLAY_NAME}`]: CatalogSystemKey.DETAILING,
  [`${QUALITY_CHECK_CATEGORY_NAME}/${QUALITY_CHECK_JOB_DISPLAY_NAME}`]: CatalogSystemKey.QUALITY_CHECK,
};
const SYSTEM_CATEGORY_KEYS: Record<string, string> = {
  [PM_CATEGORY_NAME]: CatalogCategorySystemKey.PM,
  [DETAILING_CATEGORY_NAME]: CatalogCategorySystemKey.DETAILING,
  [QUALITY_CHECK_CATEGORY_NAME]: CatalogCategorySystemKey.QUALITY_CHECK,
};

function slug(text: string) {
  return normalizeCatalogText(text) || text.trim().toLowerCase();
}

export function categorySeedKey(name: string) {
  return `category:${slug(name)}`;
}

export function jobSeedKey(categoryName: string, displayName: string) {
  return `job:${slug(categoryName)}/${slug(displayName)}`;
}

/**
 * The seed catalog, applied on every release (`npm run prisma:apply-catalog`) and by the local seed.
 *
 * LTR-198 / JC1, D30: it only **adds what is missing**. A row it created (or claimed once by its seed name) carries a
 * `seed_key` and is found by it afterwards — so a Job or Category the Shop Manager renamed, deactivated or re-aliased
 * is never renamed back, reactivated or re-aliased, and never duplicated. An alias is created only when no Job uses
 * that text yet.
 */
export async function applyJobCatalog(
  prisma: JobCatalogClient,
  options: { createdById?: string } = {},
) {
  const categoryIds = await ensureCatalogCategories(prisma);

  // Old data only: Jobs that lived in another Category before LTR-24 move to theirs, the first time they are claimed.
  for (const relocation of JOB_RELOCATIONS) {
    const destinationId = categoryIds[relocation.toCategory];
    if (!destinationId) continue;
    await prisma.catalogJob.updateMany({
      where: { displayName: relocation.displayName, categoryId: { not: destinationId }, seedKey: null },
      data: { categoryId: destinationId },
    });
  }

  let jobCount = 0;
  for (const category of JOB_CATALOG_CATEGORIES) {
    const categoryId = categoryIds[category.name];
    for (const item of category.jobs) {
      const job = await ensureCatalogJob(prisma, {
        categoryId,
        categoryName: category.name,
        item,
        createdById: options.createdById,
      });
      jobCount += 1;
      for (const alias of listCatalogJobAliasTexts(item)) {
        const aliasNorm = normalizeCatalogAlias(alias);
        if (!aliasNorm) continue;
        // Never take an alias away from a Job that already has it (the Manager may have moved it).
        await prisma.jobAlias.createMany({
          data: [{ catalogJobId: job.id, aliasText: alias, aliasNorm }],
          skipDuplicates: true,
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

async function claimKeys<T extends { id: string; seedKey: string | null; systemKey: string | null }>(
  current: T,
  seedKey: string,
  systemKey: string | undefined,
  owner: (key: string) => Promise<{ id: string } | null>,
  update: (data: { seedKey?: string; systemKey?: string }) => Promise<T>,
): Promise<T> {
  const data: { seedKey?: string; systemKey?: string } = {};
  if (!current.seedKey) data.seedKey = seedKey;
  if (systemKey && !current.systemKey) {
    const taken = await owner(systemKey);
    if (!taken) data.systemKey = systemKey;
  }
  return Object.keys(data).length ? update(data) : current;
}

async function ensureCatalogCategories(prisma: JobCatalogClient) {
  const categoryIds: Record<string, string> = {};

  for (const category of JOB_CATALOG_CATEGORIES) {
    const seedKey = categorySeedKey(category.name);
    const systemKey = SYSTEM_CATEGORY_KEYS[category.name];
    const claimed = await prisma.jobCategory.findUnique({ where: { seedKey } });
    if (claimed) {
      categoryIds[category.name] = claimed.id;
      continue;
    }

    // First time: claim the row with this seed name (or an older name it replaced), as LTR-24 merged them.
    const names = [category.name, ...category.legacyNames];
    const matches = await prisma.jobCategory.findMany({
      where: { name: { in: names }, seedKey: null },
      orderBy: { createdAt: 'asc' },
    });
    const winner = matches.find((row) => row.name === category.name) ?? matches[0] ?? null;
    const row = winner
      ? await claimKeys(
        winner,
        seedKey,
        systemKey,
        (key) => prisma.jobCategory.findUnique({ where: { systemKey: key }, select: { id: true } }),
        (data) => prisma.jobCategory.update({ where: { id: winner.id }, data }),
      )
      : await prisma.jobCategory.create({
        data: { name: category.name, sortOrder: category.sortOrder, status: 'active', seedKey, systemKey: systemKey ?? null },
      });

    // An older Category still active is merged into this one (its Work Orders and Jobs move; it stays, inactive).
    const losers = matches.filter((match) => match.id !== row.id && match.status === 'active');
    if (losers.length) {
      const loserIds = losers.map((loser) => loser.id);
      await prisma.workOrder.updateMany({ where: { primaryCategoryId: { in: loserIds } }, data: { primaryCategoryId: row.id } });
      await prisma.workOrderJob.updateMany({ where: { categoryId: { in: loserIds } }, data: { categoryId: row.id } });
      await prisma.catalogJob.updateMany({ where: { categoryId: { in: loserIds } }, data: { categoryId: row.id } });
      await prisma.jobCategory.updateMany({
        where: { id: { in: loserIds } },
        data: { status: 'inactive', inactiveReason: `Merged into ${row.name}` },
      });
    }

    categoryIds[category.name] = row.id;
  }

  return categoryIds;
}

async function ensureCatalogJob(
  prisma: JobCatalogClient,
  input: { categoryId: string; categoryName: string; item: CatalogJobDefinition; createdById?: string },
) {
  const seedKey = jobSeedKey(input.categoryName, input.item.displayName);
  const systemKey = SYSTEM_JOB_KEYS[`${input.categoryName}/${input.item.displayName}`];
  const claimed = await prisma.catalogJob.findUnique({ where: { seedKey } });
  if (claimed) return claimed;

  // First time: claim the Job with this seed name (or an older one) in its Category; nothing else about it changes.
  const names = [input.item.displayName, ...(input.item.legacyNames ?? [])];
  const existing = await prisma.catalogJob.findFirst({
    where: { categoryId: input.categoryId, displayName: { in: names }, seedKey: null },
    orderBy: { createdAt: 'asc' },
  })
    // Renamed by the Manager before this release: its seed aliases (other than the old name) are still on it.
    ?? await prisma.catalogJob.findFirst({
      where: {
        categoryId: input.categoryId,
        seedKey: null,
        aliases: { some: { aliasNorm: { in: input.item.aliases.map(normalizeCatalogAlias).filter(Boolean) } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  if (existing) {
    return claimKeys(
      existing,
      seedKey,
      systemKey,
      (key) => prisma.catalogJob.findUnique({ where: { systemKey: key }, select: { id: true } }),
      (data) => prisma.catalogJob.update({ where: { id: existing.id }, data }),
    );
  }

  return prisma.catalogJob.create({
    data: {
      displayName: input.item.displayName,
      categoryId: input.categoryId,
      status: 'active',
      createdById: input.createdById,
      seedKey,
      systemKey: systemKey ?? null,
    },
  });
}
