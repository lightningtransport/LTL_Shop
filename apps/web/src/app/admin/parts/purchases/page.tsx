import { cookies } from 'next/headers';
import { AdminPurchases } from '@/components/admin-purchases';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminPurchasesPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminPurchases locale={locale} messages={getAdminMessages(locale)} />;
}
