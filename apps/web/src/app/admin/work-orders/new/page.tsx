import { cookies } from 'next/headers';
import { AdminNewWorkOrder } from '@/components/admin-new-work-order';
import { getAdminMessages } from '@/lib/admin-messages-catalog';
import { isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminNewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ truck?: string }>;
}) {
  const [cookieStore, params] = await Promise.all([cookies(), searchParams]);
  const cookieLocale = cookieStore.get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return (
    <AdminNewWorkOrder
      locale={locale}
      messages={getAdminMessages(locale)}
      preselectTruckId={params.truck}
    />
  );
}
