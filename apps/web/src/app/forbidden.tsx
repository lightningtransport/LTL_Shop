'use client';

import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useShopLocale } from '@/lib/locale-context';

export default function Forbidden() {
  const { messages } = useShopLocale();
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <Card className="w-full text-center">
        <CardHeader>
          <ShieldX aria-hidden="true" className="mx-auto size-10 text-destructive" />
          <CardTitle className="mt-3">{messages.locale === 'es' ? 'Acceso a Shop Admin denegado' : 'Shop Admin access denied'}</CardTitle>
          <CardDescription>{messages.locale === 'es' ? 'Tu cuenta no tiene permiso para abrir el espacio administrativo.' : 'Your account does not have permission to open the administrative workspace.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full"><Link href="/">{messages.locale === 'es' ? 'Volver al Inicio de mecánicos' : 'Return to mechanic Home'}</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
