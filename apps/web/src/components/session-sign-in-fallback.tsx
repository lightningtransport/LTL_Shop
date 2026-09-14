'use client';

import Link from 'next/link';
import { AuthBrandHeader, Button } from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';

export function SessionSignInFallback() {
  const { messages } = useShopLocale();
  return (
    <div>
      <AuthBrandHeader title={messages.signIn} subtitle={messages.signInHint} />
      <Button asChild className="w-full">
        <Link href="/login">{messages.signIn}</Link>
      </Button>
    </div>
  );
}
