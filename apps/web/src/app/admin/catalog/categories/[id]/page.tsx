import { cookies } from 'next/headers';
import { AdminCatalogCategoryDetail } from '@/components/admin-catalog-category-detail';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminCatalogCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, cookieStore] = await Promise.all([params, cookies()]);
  const cookieLocale = cookieStore.get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminCatalogCategoryDetail id={id} locale={locale} messages={getAdminMessages(locale)} />;
}
