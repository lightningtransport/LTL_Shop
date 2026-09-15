import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { AdminYardOperations } from '@/components/admin-yard-operations';
import { PageSkeleton } from '@/components/ui/composites';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminYardOperationsPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  const messages = getAdminMessages(locale);
  return <Suspense fallback={<PageSkeleton label={messages.loadingYardOperations} />}><AdminYardOperations locale={locale} messages={messages} /></Suspense>;
}
