'use client';

import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';

/** LTR-293 §11: a wrong address says so in the app's language and offers the way home, instead of Next's English 404. */
export default function NotFound() {
  const { messages } = useShopLocale();
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <Card className="w-full text-center">
        <CardHeader>
          <SearchX aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
          <CardTitle className="mt-3">{messages.notFoundTitle}</CardTitle>
          <CardDescription>{messages.notFoundBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full"><Link href="/">{messages.forbiddenBack}</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
