import { cookies } from 'next/headers';
import { AdminShopWorkflow } from '@/components/admin-shop-workflow';
import { getAdminMessages } from '@/lib/admin-messages-catalog';
import { isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

/** D-SET5: Shop hours is a tab of Shop workflow with its own URL. */
export default async function AdminShopHoursPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminShopWorkflow locale={locale} messages={getAdminMessages(locale)} tab="hours" />;
}
