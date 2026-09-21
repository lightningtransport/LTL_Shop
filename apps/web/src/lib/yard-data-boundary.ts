import {
  YARD_DATA_BOUNDARY_COPY,
  type YardDataBoundaryLocale,
  type YardDataBoundaryStatus,
} from '@ltl-shop/shared';

export const ADMIN_YARD_DATA_BOUNDARY_PATH = '/api/admin/yard/data-boundary';

export type YardDataBoundaryCardKind = 'loading' | 'unavailable' | 'empty' | 'ok';

export function yardDataBoundaryCopy(locale: YardDataBoundaryLocale) {
  return YARD_DATA_BOUNDARY_COPY[locale];
}

export function yardDataBoundaryCardKind(
  section: { status: YardDataBoundaryStatus; items: readonly unknown[] } | undefined,
  options: { loading: boolean; fetchFailed: boolean },
): YardDataBoundaryCardKind {
  if (options.loading) return 'loading';
  if (options.fetchFailed || !section || section.status === 'unavailable' || section.status === 'error') {
    return 'unavailable';
  }
  return section.items.length === 0 ? 'empty' : 'ok';
}

export function formatYardBoundaryDrivers(drivers?: readonly string[]) {
  return drivers?.filter((name) => name.trim().length > 0).join(', ') ?? '';
}
