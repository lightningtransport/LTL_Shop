import { describe, expect, it } from 'vitest';
import type { CatalogJobDto } from '@ltl-shop/shared';
import { catalogJobsPath, filterCatalogJobs, matchesCatalogText } from './job-catalog';

const brakes: CatalogJobDto[] = [
  {
    id: 'job-brake-inspection',
    categoryId: 'cat-brakes',
    displayName: 'Brake Inspection',
    aliases: ['brake check', 'inspección de frenos'],
  },
  {
    id: 'job-chamber',
    categoryId: 'cat-brakes',
    displayName: 'Inspect brake chamber',
    aliases: ['chamber'],
  },
];

describe('catalogJobsPath', () => {
  it('loads a category list without q', () => {
    expect(catalogJobsPath('11111111-1111-4111-8111-111111111111')).toBe(
      '/api/catalog/jobs?categoryId=11111111-1111-4111-8111-111111111111',
    );
    expect(catalogJobsPath('cat-brakes')).not.toContain('q=');
  });
});

describe('filterCatalogJobs', () => {
  it('returns the full in-category list when search is empty', () => {
    expect(filterCatalogJobs(brakes, '')).toEqual(brakes);
    expect(filterCatalogJobs(brakes, '   ')).toEqual(brakes);
  });

  it('filters the loaded list by display name or alias without replacing it', () => {
    expect(filterCatalogJobs(brakes, 'chamber').map((job) => job.id)).toEqual(['job-chamber']);
    expect(filterCatalogJobs(brakes, 'frenos').map((job) => job.id)).toEqual(['job-brake-inspection']);
    expect(filterCatalogJobs(brakes, '3-in-1')).toEqual([]);
  });

  it('matches compact aliases the same way catalog search does', () => {
    expect(matchesCatalogText('3 in 1', '3in1')).toBe(true);
    expect(matchesCatalogText('Brake Inspection', 'brake')).toBe(true);
  });
});
