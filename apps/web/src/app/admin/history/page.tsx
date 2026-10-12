import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { AdminHistoryList } from '@/components/admin-history-list';
import { PageSkeleton } from '@/components/ui';
import { getAdminMessages } from '@/lib/admin-messages-catalog';
import { isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminHistoryPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  const messages = getAdminMessages(locale);
  return <Suspense fallback={<PageSkeleton label={messages.historyTitle} />}><AdminHistoryList locale={locale} messages={messages} /></Suspense>;
}
