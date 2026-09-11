import { cookies } from 'next/headers';
import { AdminNewWorkOrder } from '@/components/admin-new-work-order';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminNewWorkOrderPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminNewWorkOrder locale={locale} messages={getAdminMessages(locale)} />;
}
