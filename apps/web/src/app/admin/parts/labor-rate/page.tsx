import { cookies } from 'next/headers';
import { AdminLaborRate } from '@/components/admin-labor-rate';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminLaborRatePage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminLaborRate locale={locale} messages={getAdminMessages(locale)} />;
}
