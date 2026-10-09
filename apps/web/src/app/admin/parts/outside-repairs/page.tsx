import { cookies } from 'next/headers';
import { AdminOutsideRepairs } from '@/components/admin-outside-repairs';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminOutsideRepairsPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminOutsideRepairs locale={locale} messages={getAdminMessages(locale)} />;
}
