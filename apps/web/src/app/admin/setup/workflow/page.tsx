import { cookies } from 'next/headers';
import { AdminShopWorkflow } from '@/components/admin-shop-workflow';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminShopWorkflowPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminShopWorkflow locale={locale} messages={getAdminMessages(locale)} />;
}
