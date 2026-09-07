import { cookies } from 'next/headers';
import { CheckCircle2, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { getAdminMessages, isAdminLocale } from '@/lib/admin-messages';
import { ADMIN_LOCALE_COOKIE } from '@/lib/admin-session';

export default async function AdminHomePage() {
  const cookieLocale = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  const locale = isAdminLocale(cookieLocale) ? cookieLocale : 'en';
  const messages = getAdminMessages(locale);

  return (
    <div className="space-y-6">
      <header>
        <p className="section-label">{messages.eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-wide sm:text-4xl">{messages.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{messages.description}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{messages.foundationTitle}</CardTitle>
          <CardDescription>{messages.foundationBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border bg-background p-4">
            <CheckCircle2 aria-hidden="true" className="size-6 text-success" />
            <h2 className="mt-4 font-display text-lg font-semibold">{messages.secureAccess}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{messages.secureAccessBody}</p>
          </section>
          <section className="rounded-xl border bg-background p-4">
            <Eye aria-hidden="true" className="size-6 text-primary" />
            <h2 className="mt-4 font-display text-lg font-semibold">{messages.nextPhase}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{messages.nextPhaseBody}</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
