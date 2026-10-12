import { cookies } from 'next/headers';
import { AdminCustomJobsReview } from '@/components/admin-custom-jobs-review';
import { getAdminMessages } from '@/lib/admin-messages-catalog';
import { isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminCustomJobsReviewPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminCustomJobsReview locale={locale} messages={getAdminMessages(locale)} />;
}
