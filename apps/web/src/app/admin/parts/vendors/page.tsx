import { cookies } from 'next/headers';
import { AdminVendors } from '@/components/admin-vendors';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminVendorsPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminVendors locale={locale} messages={getAdminMessages(locale)} />;
}
