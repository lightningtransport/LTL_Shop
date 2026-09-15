'use client';

import Link from 'next/link';
import { AuthBrandHeader } from '@/components/ui/composites';
import { Button } from '@/components/ui/button';
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
