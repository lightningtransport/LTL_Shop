import type { CatalogJobDto, JobAliasOptionDto } from '@ltl-shop/shared';
import { apiFetch } from './api';

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

export function filterAliasOptions(
  aliases: JobAliasOptionDto[],
  q: string,
): JobAliasOptionDto[] {
  const query = q.trim();
  if (!query) return aliases;
  const norm = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  return aliases.filter((a) => {
    const text = a.aliasText.toLowerCase();
    const textNorm = text.replace(/[^a-z0-9]/g, '');
    return text.includes(query.toLowerCase()) || textNorm.includes(norm);
  });
}

export function canonicalAliasOptions(
  aliases: JobAliasOptionDto[],
  query = '',
): JobAliasOptionDto[] {
  const byCatalogId = new Map<string, JobAliasOptionDto>();
  for (const alias of filterAliasOptions(aliases, query)) {
    if (!byCatalogId.has(alias.catalogJobId)) byCatalogId.set(alias.catalogJobId, alias);
  }
  return [...byCatalogId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
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
