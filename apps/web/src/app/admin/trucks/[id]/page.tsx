import { cookies } from 'next/headers';
import { AdminTruckDetail } from '@/components/admin-truck-detail';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminTruckDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; tab?: string }>;
}) {
  const [{ id }, { from, tab }, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const cookieLocale = cookieStore.get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminTruckDetail id={id} from={from ?? null} tab={tab ?? null} locale={locale} messages={getAdminMessages(locale)} />;
}
