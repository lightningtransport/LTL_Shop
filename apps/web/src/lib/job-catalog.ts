import { normalizeCatalogText, type CatalogJobDto, type JobAliasOptionDto } from '@ltl-shop/shared';
import { apiFetch } from './api';

export function catalogJobsPath(categoryId: string) {
  const params = new URLSearchParams({ categoryId });
  return `/api/catalog/jobs?${params}`;
}

/** LTR-198 / JC5: accents and capitals do not count ("lineas" finds "Líneas de combustible"). */
export function matchesCatalogText(value: string, query: string) {
  const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const needle = fold(query.trim());
  if (!needle) return true;
  const needleNorm = normalizeCatalogText(needle);
  const text = fold(value);
  return text.includes(needle) || (Boolean(needleNorm) && normalizeCatalogText(text).includes(needleNorm));
}

/** Client-side filter of a category's already-loaded catalog jobs. Does not call the API. */
export function filterCatalogJobs(jobs: CatalogJobDto[], q: string): CatalogJobDto[] {
  const query = q.trim();
  if (!query) return jobs;
  return jobs.filter((job) =>
    matchesCatalogText(job.displayName, query)
    || (job.aliases ?? []).some((alias) => matchesCatalogText(alias, query)),
  );
}

export function flattenJobAliases(jobs: CatalogJobDto[]): JobAliasOptionDto[] {
  const rows: JobAliasOptionDto[] = [];
  for (const job of jobs) {
    const aliasTexts = job.aliases?.length ? job.aliases : [job.displayName];
    for (const aliasText of aliasTexts) {
      rows.push({
        aliasText,
        catalogJobId: job.id,
        categoryId: job.categoryId,
        displayName: job.displayName,
      });
    }
  }
  return rows.sort((a, b) => a.aliasText.localeCompare(b.aliasText));
}

export async function fetchAliasOptions(
  categoryId?: string,
): Promise<JobAliasOptionDto[]> {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);

  try {
    return await apiFetch<JobAliasOptionDto[]>(
      `/api/catalog/aliases?${params}`,
    );
  } catch {
    const jobs = await apiFetch<CatalogJobDto[]>(
      `/api/catalog/jobs?${params}`,
    );
    return flattenJobAliases(jobs);
  }
}
