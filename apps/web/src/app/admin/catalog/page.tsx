import { cookies } from 'next/headers';
import { AdminCatalogList } from '@/components/admin-catalog-list';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminCatalogPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminCatalogList locale={locale} messages={getAdminMessages(locale)} />;
}
