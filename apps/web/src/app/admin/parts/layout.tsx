import { cookies } from 'next/headers';
import { AdminPartsGate } from '@/components/admin-parts-gate';
import { getAdminMessages } from '@/lib/admin-messages-catalog';
import { isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

/** PCA12 (UX-5-007): every Parts & costs screen is behind the same "Manager and System Admin only" door. */
export default async function AdminPartsLayout({ children }: { children: React.ReactNode }) {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminPartsGate messages={getAdminMessages(locale)}>{children}</AdminPartsGate>;
}
