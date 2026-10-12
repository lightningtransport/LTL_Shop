import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { AdminWorkOrdersList } from '@/components/admin-work-orders-list';
import { PageSkeleton } from '@/components/ui';
import { getAdminMessages } from '@/lib/admin-messages-catalog';
import { isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminWorkOrdersPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  const messages = getAdminMessages(locale);
  return <Suspense fallback={<PageSkeleton label={messages.workOrdersTitle} />}><AdminWorkOrdersList locale={locale} messages={messages} /></Suspense>;
}
