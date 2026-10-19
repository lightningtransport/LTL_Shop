import { redirect } from 'next/navigation';

/**
 * LTR-248 (UX-5-004, D47 P34): History became the "Closed" filter of Work Orders (completed and cancelled), so closed
 * work has one place. Old links keep their search.
 */
export default async function AdminHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = typeof params.status === 'string' && ['completed', 'cancelled'].includes(params.status) ? params.status : 'completed,cancelled';
  const next = new URLSearchParams({ status });
  if (typeof params.search === 'string' && params.search) next.set('search', params.search);
  redirect(`/admin/work-orders?${next.toString()}`);
}
