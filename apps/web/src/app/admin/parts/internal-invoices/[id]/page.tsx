import { cookies } from 'next/headers';
import { AdminInternalInvoiceDetail } from '@/components/admin-internal-invoice-detail';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminInternalInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, cookieStore] = await Promise.all([params, cookies()]);
  const cookieLocale = cookieStore.get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminInternalInvoiceDetail id={id} locale={locale} messages={getAdminMessages(locale)} />;
}
