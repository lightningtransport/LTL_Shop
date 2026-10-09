import { cookies } from 'next/headers';
import { AdminPartsCatalog } from '@/components/admin-parts-catalog';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminPartsCatalogPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminPartsCatalog locale={locale} messages={getAdminMessages(locale)} />;
}
