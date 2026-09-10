import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { AdminMechanicsList } from '@/components/admin-mechanics-list';
import { PageSkeleton } from '@/components/ui';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminMechanicsPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  const messages = getAdminMessages(locale);
  return <Suspense fallback={<PageSkeleton label={messages.mechanicsTitle} />}><AdminMechanicsList locale={locale} messages={messages} /></Suspense>;
}
