import { InspectionSection, ShopWorkflowStepKey, normalizeCatalogText } from '@ltl-shop/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PM_CATEGORY_NAME, jobSeedKey } from './job-catalog';

/**
 * D41: the shop's paper inspection sheet (Lightning Transport), as the base list of
 * Setup → Inspection checklist. Each check names the catalog Job a defect creates
 * (`category` / `job`), or the mandatory step it becomes a note on (`step`, Detailing).
 * Spelling fixed from the paper; "Air Leaks" once; tire pressure lives in the Tires part.
 */
export type InspectionChecklistSeed = {
  section: InspectionSection;
  label: string;
} & ({ category: string; job: string; step?: never } | { step: ShopWorkflowStepKey; category?: never; job?: never });

const job = (section: InspectionSection, label: string, category: string, jobName: string): InspectionChecklistSeed =>
  ({ section, label, category, job: jobName });
const step = (section: InspectionSection, label: string, stepKey: ShopWorkflowStepKey): InspectionChecklistSeed =>
  ({ section, label, step: stepKey });

const I = InspectionSection.INTERIOR;
const E = InspectionSection.ENGINE;
const X = InspectionSection.EXTERIOR;
const CAB = 'Cab, Body & Glass';
const ELECTRICAL = 'Electrical & Starting';
const AIR = 'Air & Brake System';
const HVAC = 'HVAC / A/C';
const ENGINE = 'Engine & Emissions';
const DETAILING = ShopWorkflowStepKey.DETAILING;

export const INSPECTION_CHECKLIST_SEED: InspectionChecklistSeed[] = [
  job(I, 'Mirrors', CAB, 'Mirrors'),
  job(I, 'Windshield wipers', CAB, 'Wipers'),
  job(I, 'Horn', ELECTRICAL, 'Horn'),
  job(I, 'Parking brake', AIR, 'Parking Brake'),
  job(I, 'Fans / defroster', HVAC, 'Blower Motor'),
  job(I, 'Heater / A/C', HVAC, 'Climate System'),
  job(I, 'Radio / cellphone', ELECTRICAL, 'Radio & Phone'),
  job(I, 'Passenger door', CAB, 'Doors'),
  job(I, 'Interior lights', ELECTRICAL, 'Lights'),
  job(I, 'Driver seat & belts', CAB, 'Seats & Belts'),
  job(I, 'Passenger seats', CAB, 'Seats & Belts'),
  job(I, 'Fire extinguisher', CAB, 'Safety Equipment'),
  step(I, 'Windows clean', DETAILING),
  step(I, 'Interior clean', DETAILING),
  job(I, 'Cab air filter', PM_CATEGORY_NAME, 'Filter Service'),

  job(E, 'Fuel level', PM_CATEGORY_NAME, 'Fluid Top-Off'),
  job(E, 'Oil level / pressure', PM_CATEGORY_NAME, 'Oil Change'),
  job(E, 'Transmission fluid', 'Transmission & Drivetrain', 'Transmission'),
  job(E, 'Power steering fluid', 'Suspension & Steering', 'Steering'),
  job(E, 'Battery charge', ELECTRICAL, 'Battery'),
  job(E, 'Washer fluid', PM_CATEGORY_NAME, 'Fluid Top-Off'),
  job(E, 'Radiator fluid level', 'Cooling System', 'Coolant Service'),
  job(E, 'Fluids leaking under', ENGINE, 'Engine Leak Repair'),
  job(E, 'Engine warning lights', ENGINE, 'Derate Diagnose'),
  job(E, 'EGR cooler', ENGINE, 'EGR Service'),
  job(E, 'Soot level', ENGINE, 'DPF/DEF Service'),
  job(E, 'Engine air filter', PM_CATEGORY_NAME, 'Filter Service'),

  job(X, 'Headlights (high / low)', ELECTRICAL, 'Lights'),
  job(X, 'Fog / hazard lamps', ELECTRICAL, 'Lights'),
  job(X, 'Windshield', CAB, 'Windshield'),
  job(X, 'Turn signals front / rear', ELECTRICAL, 'Lights'),
  job(X, 'Tail / running lights', ELECTRICAL, 'Lights'),
  job(X, 'Brake lights', ELECTRICAL, 'Lights'),
  job(X, 'Tire condition', 'Tires & Wheels', 'Tires'),
  job(X, 'Luggage doors & engine panels', CAB, 'Body Work'),
  step(X, 'Exterior clean', DETAILING),
  job(X, 'Body (scratches, dings, dents)', CAB, 'Body Work'),
  job(X, 'Gladhand seals', AIR, 'Air Lines'),
  job(X, 'Rear end seals / breathers', 'Transmission & Drivetrain', 'Differential'),
  job(X, 'Grease', PM_CATEGORY_NAME, 'Lubrication'),
  job(X, 'Belts / tensioners', ENGINE, 'Belts & Tensioners'),
  job(X, 'Battery cables', ELECTRICAL, 'Battery'),
  job(X, 'Fuses', ELECTRICAL, 'Wiring'),
  job(X, 'Wheel seals / hub', 'Tires & Wheels', 'Wheel Seals'),
  job(X, 'Brakes', AIR, 'Brake Inspection'),
  job(X, 'Air leaks', AIR, 'Air Leak'),
  job(X, 'Air dryer', AIR, 'Air Dryer'),
  job(X, 'Air manifold', AIR, 'Inspect Air System'),
  job(X, 'DEF lines', ENGINE, 'DPF/DEF Service'),
  job(X, 'Coolant lines', 'Cooling System', 'Cooling Hoses'),
  job(X, 'Transmission lines', 'Transmission & Drivetrain', 'Transmission'),
  job(X, 'Pigtail / trailer air lines', AIR, 'Air Lines'),
  job(X, 'Deer guard', CAB, 'Body Work'),
];

export function inspectionChecklistSeedKey(item: Pick<InspectionChecklistSeed, 'section' | 'label'>) {
  return `inspection:${item.section}/${normalizeCatalogText(item.label) || item.label.trim().toLowerCase()}`;
}

type ChecklistClient = PrismaClient | Prisma.TransactionClient;

/**
 * D41: applied on every release right after the job catalog (`npm run prisma:apply-catalog`) and by the
 * local seed. Like the catalog (D30), it only **adds what is missing**: a check the Manager renamed,
 * re-pointed, reordered or deactivated keeps its `seed_key` and is never touched again.
 */
export async function applyInspectionChecklist(prisma: ChecklistClient) {
  const existing = await prisma.inspectionChecklistItem.findMany({
    where: { seedKey: { not: null } },
    select: { seedKey: true },
  });
  const seen = new Set(existing.map((row) => row.seedKey));
  let created = 0;

  for (const [index, item] of INSPECTION_CHECKLIST_SEED.entries()) {
    const seedKey = inspectionChecklistSeedKey(item);
    if (seen.has(seedKey)) continue;
    let catalogJobId: string | null = null;
    if (item.job) {
      const catalogJob = await prisma.catalogJob.findUnique({
        where: { seedKey: jobSeedKey(item.category, item.job) },
        select: { id: true },
      });
      if (!catalogJob) throw new Error(`Inspection checklist: catalog Job ${item.category} / ${item.job} is missing — apply the job catalog first`);
      catalogJobId = catalogJob.id;
    }
    await prisma.inspectionChecklistItem.create({
      data: {
        section: item.section,
        label: item.label,
        sortOrder: (index + 1) * 10,
        catalogJobId,
        workflowStepKey: item.step ?? null,
        seedKey,
      },
    });
    seen.add(seedKey);
    created += 1;
  }

  return { checks: INSPECTION_CHECKLIST_SEED.length, created };
}
