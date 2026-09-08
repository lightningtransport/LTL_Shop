import Image from 'next/image';
import Link from 'next/link';
import { ClipboardList, Gauge, History, Library, Truck, UsersRound, Wrench } from 'lucide-react';
import { AdminLocaleSwitcher } from './admin-locale-switcher';
import { AppHeaderActions, Badge, Button } from './ui';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

const futureNavigation = [
  { message: 'workOrders', icon: ClipboardList },
  { message: 'trucks', icon: Truck },
  { message: 'mechanics', icon: UsersRound },
  { message: 'jobCatalog', icon: Library },
  { message: 'history', icon: History },
] as const;

export function AdminShell({
  children,
  locale,
  messages,
  user,
}: {
  children: React.ReactNode;
  locale: AdminLocale;
  messages: AdminMessages;
  user: { name: string; role: string };
}) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="hidden border-r bg-card px-4 py-5 lg:flex lg:flex-col" aria-label={messages.navigation}>
        <AdminBrand />
        <nav className="mt-8 space-y-1">
          <Button asChild variant="secondary" className="w-full justify-start">
            <Link href="/admin" aria-current="page">
              <Gauge aria-hidden="true" className="size-4" />
              {messages.dashboard}
            </Link>
          </Button>
          {futureNavigation.map(({ message, icon: Icon }) => (
            <div key={message} className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm text-muted-foreground" aria-disabled="true" title={messages.comingLater}>
              <Icon aria-hidden="true" className="size-4" />
              <span>{messages[message]}</span>
              <Badge variant="secondary" className="ml-auto">P2+</Badge>
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t pt-4 text-sm">
          <p className="truncate font-medium">{user.name}</p>
          <p className="mt-1 capitalize text-muted-foreground">{user.role}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b bg-card" aria-label="Shop Admin controls">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden"><AdminBrand compact /></div>
            <div className="ml-auto flex items-center gap-2">
              <AdminLocaleSwitcher locale={locale} messages={messages} />
              <AppHeaderActions />
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden" aria-label={messages.mobileNavigation}>
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link href="/admin" aria-current="page"><Gauge aria-hidden="true" className="size-4" />{messages.dashboard}</Link>
            </Button>
            {futureNavigation.slice(0, 3).map(({ message, icon: Icon }) => (
              <span key={message} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground" aria-disabled="true" title={messages.comingLater}>
                <Icon aria-hidden="true" className="size-4" />{messages[message]}
              </span>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/ltl-logo.png" alt="Lightning Transport and Logistics" width={1536} height={894} priority className={compact ? 'h-auto w-16' : 'h-auto w-20'} />
      {!compact ? <div><p className="font-display text-sm font-bold tracking-wide">LTL SHOP</p><p className="text-xs text-muted-foreground">ADMIN</p></div> : null}
    </div>
  );
}
