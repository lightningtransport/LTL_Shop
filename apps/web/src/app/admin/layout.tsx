import { cookies, headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export const metadata = {
  title: 'Lightning Shop — Admin',
  description: 'Secure Lightning Shop administrative workspace',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  const requestHeaders = await headers();
  if (requestHeaders.get('x-ltl-admin-denied') === 'true') forbidden();
  const encodedName = requestHeaders.get('x-ltl-admin-name');
  const user = {
    name: encodedName ? decodeURIComponent(encodedName) : 'Shop Manager',
    role: requestHeaders.get('x-ltl-admin-role') ?? 'manager',
  };

  return <AdminShell messages={getAdminMessages(locale)} user={user}>{children}</AdminShell>;
}
