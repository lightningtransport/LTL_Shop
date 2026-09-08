'use client';

import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export function AdminLocaleSwitcher({
  locale,
  messages,
}: {
  locale: AdminLocale;
  messages: AdminMessages;
}) {
  const router = useRouter();
  const nextLocale = locale === 'en' ? 'es' : 'en';

  useEffect(() => {
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = 'en';
    };
  }, [locale]);

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={locale === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'}
      onClick={() => {
        document.cookie = `${ADMIN_LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
        router.refresh();
      }}
    >
      <Languages aria-hidden="true" className="size-4" />
      {nextLocale === 'es' ? 'ES' : 'EN'}
    </Button>
  );
}
