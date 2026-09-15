import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { AdminTrucksList } from '@/components/admin-trucks-list';
import { PageSkeleton } from '@/components/ui/composites';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminTrucksPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  const messages = getAdminMessages(locale);
  return <Suspense fallback={<PageSkeleton label={messages.trucksTitle} />}><AdminTrucksList locale={locale} messages={messages} /></Suspense>;
}
