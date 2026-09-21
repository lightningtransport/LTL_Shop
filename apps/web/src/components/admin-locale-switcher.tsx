'use client';

import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';
import { shopLocaleChangeEvent, shopLocaleCookieWrite } from '@/lib/shop-locale';

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
  }, [locale]);

  return (
    <Button
      variant="outline"
      size="sm"
      className="min-w-16"
      aria-label={locale === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'}
      onClick={() => {
        document.cookie = shopLocaleCookieWrite(nextLocale);
        document.documentElement.lang = nextLocale;
        window.dispatchEvent(shopLocaleChangeEvent());
        router.refresh();
      }}
    >
      <Languages aria-hidden="true" className="size-4" />
      {nextLocale === 'es' ? 'ES' : 'EN'}
    </Button>
  );
}
