import { InspectionSection } from '@ltl-shop/shared';
import { describe, expect, it } from 'vitest';
import { INSPECTION_CHECKLIST_SEED, inspectionChecklistSeedKey } from '../../prisma/inspection-checklist';
import { JOB_CATALOG_CATEGORIES } from '../../prisma/job-catalog';

describe('D41 base inspection checklist', () => {
  it('has the 53 checks of the paper sheet: 15 interior, 12 engine, 26 exterior', () => {
    const count = (section: InspectionSection) => INSPECTION_CHECKLIST_SEED.filter((item) => item.section === section).length;
    expect(INSPECTION_CHECKLIST_SEED).toHaveLength(53);
    expect(count(InspectionSection.INTERIOR)).toBe(15);
    expect(count(InspectionSection.ENGINE)).toBe(12);
    expect(count(InspectionSection.EXTERIOR)).toBe(26);
  });

  it('gives every check its own seed key', () => {
    const keys = INSPECTION_CHECKLIST_SEED.map(inspectionChecklistSeedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('points every check to a Job of the seed catalog, or to the Detailing step', () => {
    const jobs = new Set(JOB_CATALOG_CATEGORIES.flatMap((category) => category.jobs.map((item) => `${category.name}/${item.displayName}`)));
    const missing = INSPECTION_CHECKLIST_SEED.filter((item) => item.job && !jobs.has(`${item.category}/${item.job}`));
    expect(missing).toEqual([]);
    expect(INSPECTION_CHECKLIST_SEED.filter((item) => item.step).map((item) => item.label)).toEqual(['Windows clean', 'Interior clean', 'Exterior clean']);
  });

  it('uses the 7 Jobs D41 added to the catalog', () => {
    const used = new Set(INSPECTION_CHECKLIST_SEED.map((item) => item.job));
    for (const name of ['Horn', 'Radio & Phone', 'Parking Brake', 'Seats & Belts', 'Safety Equipment', 'Fluid Top-Off', 'Belts & Tensioners']) {
      expect(used.has(name)).toBe(true);
    }
  });
});
