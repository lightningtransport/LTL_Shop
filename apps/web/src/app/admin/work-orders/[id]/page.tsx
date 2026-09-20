import { cookies } from 'next/headers';
import { AdminWorkOrderDetail } from '@/components/admin-work-order-detail';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminWorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, query, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const cookieLocale = cookieStore.get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return (
    <AdminWorkOrderDetail
      id={id}
      locale={locale}
      messages={getAdminMessages(locale)}
      justCreated={query.created === '1'}
    />
  );
}
