import { cookies } from 'next/headers';
import { AdminInspectionChecklist } from '@/components/admin-inspection-checklist';
import { getAdminMessages } from '@/lib/admin-messages-catalog';
import { isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

/** D41 / HU-M17: Setup → Inspection checklist. */
export default async function AdminInspectionChecklistPage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  return <AdminInspectionChecklist locale={locale} leaveConfirm={getAdminMessages(locale).unsavedChangesConfirm} />;
}
