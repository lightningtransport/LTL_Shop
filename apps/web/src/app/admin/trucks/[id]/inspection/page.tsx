import { cookies } from 'next/headers';
import { AdminTruckInspection } from '@/components/admin-truck-inspection';
import { isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

/** D41 / HU-M16: the inspection sheet of the Truck's current visit. */
export default async function AdminTruckInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, cookieStore] = await Promise.all([params, cookies()]);
  const cookieLocale = cookieStore.get(ADMIN_LOCALE_COOKIE)?.value;
  return <AdminTruckInspection truckId={id} locale={isAdminLocale(cookieLocale) ? cookieLocale : 'en'} />;
}
