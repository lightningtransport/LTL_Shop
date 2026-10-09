import { cookies } from 'next/headers';
import { AdminInternalInvoices } from '@/components/admin-internal-invoices';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminInternalInvoicesPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminInternalInvoices locale={locale} messages={getAdminMessages(locale)} />;
}
