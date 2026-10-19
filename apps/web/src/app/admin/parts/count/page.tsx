import { cookies } from 'next/headers';
import { AdminCountStock } from '@/components/admin-count-stock';
import { getAdminMessages } from '@/lib/admin-messages-catalog';
import { isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

/** D47 / HU-M20 (LTR-246): Parts → Count stock (in bulk). */
export default async function AdminCountStockPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminCountStock locale={locale} messages={getAdminMessages(locale)} />;
}
