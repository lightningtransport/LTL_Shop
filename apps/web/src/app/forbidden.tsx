'use client';

import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';

export default function Forbidden() {
  const { messages } = useShopLocale();
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <Card className="w-full text-center">
        <CardHeader>
          <ShieldX aria-hidden="true" className="mx-auto size-10 text-destructive-text" />
          <CardTitle className="mt-3">{messages.forbiddenTitle}</CardTitle>
          <CardDescription>{messages.forbiddenBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full"><Link href="/">{messages.forbiddenBack}</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
