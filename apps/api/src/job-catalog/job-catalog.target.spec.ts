import { describe, expect, it } from 'vitest';
import {
  DETAILING_CATALOG_CATEGORY_NAME,
  DETAILING_CATALOG_JOB_NAME,
  QUALITY_CHECK_CATALOG_CATEGORY_NAME,
  QUALITY_CHECK_CATALOG_JOB_NAME,
} from '../admin/yard-work-plan-derivation';
import {
  DETAILING_CATEGORY_NAME,
  DETAILING_JOB_DISPLAY_NAME,
  flattenCatalogAliasNorms,
  JOB_CATALOG_CATEGORIES,
  listCatalogJobAliasTexts,
  normalizeCatalogAlias,
  PM_CATEGORY_NAME,
  QUALITY_CHECK_CATEGORY_NAME,
  QUALITY_CHECK_JOB_DISPLAY_NAME,
} from '../../prisma/job-catalog';

const CURRENT_CATEGORY_NAMES = [
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

describe('LTR-24 job catalog target', () => {
  it('keeps the PM category name exactly PM so API detection stays intact', () => {
    expect(PM_CATEGORY_NAME).toBe('PM');
    expect(JOB_CATALOG_CATEGORIES[0]).toMatchObject({
      name: 'PM',
      displayNameEn: 'Preventive Maintenance (PM)',
      displayNameEs: 'Mantenimiento preventivo (PM)',
      sortOrder: 0,
    });
    expect(JOB_CATALOG_CATEGORIES.some((category) => category.name === 'Preventive Maintenance (PM)')).toBe(false);
  });

  it('defines the 15 signed categories in Cristian / PD order plus LTR-35 Detailing and LTR-41 Quality Check', () => {
    expect(JOB_CATALOG_CATEGORIES.map((category) => category.name)).toEqual([
      'PM',
      'Inspection',
      'Engine & Emissions',
      'Fuel System',
      'Cooling System',
      'Electrical & Starting',
      'Air & Brake System',
      'Suspension & Steering',
      'Transmission & Drivetrain',
      'Tires & Wheels',
      'HVAC / A/C',
      'Cab, Body & Glass',
      'Trailer',
      'Road Service & Towing',
      'Detailing',
      'Quality Check',
      'Other',
    ]);
    expect(JOB_CATALOG_CATEGORIES.map((category) => category.sortOrder)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });

  it('keeps Detailing and Quality Check identical in EN and ES and does not rename PM', () => {
    const detailing = JOB_CATALOG_CATEGORIES.find((category) => category.name === DETAILING_CATEGORY_NAME);
    expect(detailing).toMatchObject({
      name: 'Detailing',
      displayNameEn: 'Detailing',
      displayNameEs: 'Detailing',
      sortOrder: 14,
      jobs: [{ displayName: DETAILING_JOB_DISPLAY_NAME, aliases: [] }],
    });
    const qualityCheck = JOB_CATALOG_CATEGORIES.find((category) => category.name === QUALITY_CHECK_CATEGORY_NAME);
    expect(qualityCheck).toMatchObject({
      name: 'Quality Check',
      displayNameEn: 'Quality Check',
      displayNameEs: 'Quality Check',
      sortOrder: 15,
      jobs: [{ displayName: QUALITY_CHECK_JOB_DISPLAY_NAME }],
    });
    expect(PM_CATEGORY_NAME).toBe('PM');
    expect(JOB_CATALOG_CATEGORIES[0].name).toBe('PM');
    expect(DETAILING_CATEGORY_NAME).toBe(DETAILING_CATALOG_CATEGORY_NAME);
    expect(DETAILING_JOB_DISPLAY_NAME).toBe(DETAILING_CATALOG_JOB_NAME);
    expect(QUALITY_CHECK_CATEGORY_NAME).toBe(QUALITY_CHECK_CATALOG_CATEGORY_NAME);
    expect(QUALITY_CHECK_JOB_DISPLAY_NAME).toBe(QUALITY_CHECK_CATALOG_JOB_NAME);
  });

  it('remaps every CURRENT category name onto a target row', () => {
    const covered = new Set(
      JOB_CATALOG_CATEGORIES.flatMap((category) => [category.name, ...category.legacyNames]),
    );
    expect(CURRENT_CATEGORY_NAMES.every((name) => covered.has(name))).toBe(true);
    expect(JOB_CATALOG_CATEGORIES.find((category) => category.name === 'Air & Brake System')?.legacyNames)
      .toEqual(['Brakes', 'Air System']);
    expect(JOB_CATALOG_CATEGORIES.find((category) => category.name === 'Suspension & Steering')?.legacyNames)
      .toEqual(['Suspension', 'Alignment']);
  });

  it('seeds discrete jobs for each Cristian use-case list', () => {
    const jobsByCategory = Object.fromEntries(
      JOB_CATALOG_CATEGORIES.map((category) => [
        category.name,
        category.jobs.map((job) => job.displayName),
      ]),
    );

    expect(jobsByCategory.PM).toEqual(expect.arrayContaining([
      'Oil Change',
      'Filter Service',
      'Lubrication',
      'Scheduled Maintenance',
      'PM A Service',
      'PM B Service',
    ]));
    expect(jobsByCategory.Inspection).toEqual([
      'DOT Inspection',
      'Annual Inspection',
      'General Inspection',
    ]);
    expect(jobsByCategory['Engine & Emissions']).toEqual(expect.arrayContaining([
      'Engine Repair',
      'EGR Service',
      'Turbo Inspect',
      'Derate Diagnose',
      'Engine Leak Repair',
      'DPF/DEF Service',
    ]));
    expect(jobsByCategory['Fuel System']).toEqual([
      'Fuel Tank',
      'Fuel Lines',
      'Fuel Filters',
      'Fuel Leak',
    ]);
    expect(jobsByCategory['Cooling System']).toEqual(expect.arrayContaining([
      'Coolant Service',
      'Radiator',
      'Expansion Tank',
      'Cooling Hoses',
    ]));
    expect(jobsByCategory['Electrical & Starting']).toEqual(expect.arrayContaining([
      'Battery',
      'Alternator',
      'Starter',
      "Truck Won't Start",
    ]));
    expect(jobsByCategory['Air & Brake System']).toEqual(expect.arrayContaining([
      'Brake Inspection',
      'Brake Chambers',
      'Air Lines',
      'Air Leak',
      'Air Dryer',
    ]));
    expect(jobsByCategory['Suspension & Steering']).toEqual(expect.arrayContaining([
      'Air Bag Replacement',
      'Shock Replacement',
      'Alignment',
      'Steering',
      '3 in 1',
    ]));
    expect(jobsByCategory['Transmission & Drivetrain']).toEqual(expect.arrayContaining([
      'Transmission',
      'Clutch',
      'Differential',
      '5th Wheel',
    ]));
    expect(jobsByCategory['Tires & Wheels']).toEqual(expect.arrayContaining([
      'Tires',
      'Rims',
      'Flat Repair',
      'Hubs',
    ]));
    expect(jobsByCategory['HVAC / A/C']).toEqual(['A/C', 'Heater', 'Blower Motor', 'Climate System']);
    expect(jobsByCategory['Cab, Body & Glass']).toEqual(expect.arrayContaining([
      'Windshield',
      'Mirrors',
      'Doors',
      'Wipers',
    ]));
    expect(jobsByCategory.Trailer).toEqual(['Trailer Repair']);
    expect(jobsByCategory['Road Service & Towing']).toEqual([
      'Road Service',
      'Towing',
      'Winch Out',
      'Lockout',
    ]);
    expect(jobsByCategory.Detailing).toEqual(['Detailing']);
    expect(jobsByCategory['Quality Check']).toEqual(['Quality Check']);
    expect(jobsByCategory.Other).toEqual(['Uncategorized']);
    expect(JOB_CATALOG_CATEGORIES.every((category) => category.jobs.length >= 1)).toBe(true);
  });

  it('keeps alias_norm unique across jobs so search upserts stay deterministic', () => {
    const ownerByNorm = new Map<string, string>();
    for (const category of JOB_CATALOG_CATEGORIES) {
      for (const job of category.jobs) {
        const owner = `${category.name}:${job.displayName}`;
        for (const alias of listCatalogJobAliasTexts(job)) {
          const norm = normalizeCatalogAlias(alias);
          const existing = ownerByNorm.get(norm);
          if (existing && existing !== owner) {
            throw new Error(`alias_norm "${norm}" is claimed by ${existing} and ${owner}`);
          }
          ownerByNorm.set(norm, owner);
        }
      }
    }
    expect(flattenCatalogAliasNorms().length).toBeGreaterThan(JOB_CATALOG_CATEGORIES.length);
  });
});
