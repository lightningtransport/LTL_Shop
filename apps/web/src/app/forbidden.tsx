import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';

export default function Forbidden() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <Card className="w-full text-center">
        <CardHeader>
          <ShieldX aria-hidden="true" className="mx-auto size-10 text-destructive" />
          <CardTitle className="mt-3">Shop Admin access denied</CardTitle>
          <CardDescription>Your account does not have permission to open the administrative workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full"><Link href="/">Return to mechanic Home</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
