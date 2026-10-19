import { redirect } from 'next/navigation';

/**
 * D47 / HU-M20 (LTR-246): Stock left the menu; Parts is the inventory. Old links (a purchase line "To stock",
 * bookmarks) land on Parts with what is on the shelf, keeping the search.
 */
export default async function AdminStockPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = new URLSearchParams({ inStock: 'true' });
  const q = typeof params.q === 'string' ? params.q : '';
  if (q) next.set('q', q);
  if (params.low === 'true') next.set('low', 'true');
  redirect(`/admin/parts/catalog?${next.toString()}`);
}
