import { cookies } from 'next/headers';
import { AdminSamsaraPairing } from '@/components/admin-samsara-pairing';
import { getAdminMessages } from '@/lib/admin-messages-catalog';
import { isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

/** D35 / S-1: Setup → Samsara (read-only pairing). */
export default async function AdminSamsaraPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminSamsaraPairing locale={locale} messages={getAdminMessages(locale)} />;
}
