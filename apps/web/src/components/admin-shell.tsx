'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Gauge, History, Library, Truck, UsersRound, Warehouse } from 'lucide-react';
import { AdminLocaleSwitcher } from './admin-locale-switcher';
import { AppHeaderActions, Badge, Button } from './ui';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

const futureNavigation = [
  { message: 'trucks', icon: Truck },
  { message: 'mechanics', icon: UsersRound },
  { message: 'jobCatalog', icon: Library },
  { message: 'history', icon: History },
] as const;

const activeNavigation = [
  { message: 'dashboard', icon: Gauge, href: '/admin' },
  { message: 'workOrders', icon: ClipboardList, href: '/admin/work-orders' },
  { message: 'yardOperations', icon: Warehouse, href: '/admin/yard-operations' },
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
  const pathname = usePathname();
  return (
    <div className="min-h-dvh bg-background md:grid md:h-dvh md:grid-cols-[220px_minmax(0,1fr)] md:overflow-hidden xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden h-dvh min-h-0 border-r bg-card px-3 py-4 md:flex md:flex-col xl:px-4" aria-label={messages.navigation}>
        <div className="shrink-0 px-1"><AdminBrand /></div>
        <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
          {activeNavigation.map(({ message, icon: Icon, href }) => {
            const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
            return <Button key={href} asChild variant={active ? 'secondary' : 'ghost'} className="w-full justify-start">
              <Link href={href} aria-current={active ? 'page' : undefined}>
                <Icon aria-hidden="true" className="size-4" />{messages[message]}
              </Link>
            </Button>;
          })}
          {futureNavigation.map(({ message, icon: Icon }) => (
            <div key={message} className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm text-muted-foreground" aria-disabled="true" title={messages.comingLater}>
              <Icon aria-hidden="true" className="size-4" />
              <span>{messages[message]}</span>
              <Badge variant="secondary" className="ml-auto">P2+</Badge>
            </div>
          ))}
        </nav>
        <div className="mt-3 shrink-0 border-t px-1 pt-4 text-sm">
          <p className="truncate font-medium">{user.name}</p>
          <p className="mt-1 capitalize text-muted-foreground">{user.role}</p>
        </div>
      </aside>

      <div className="min-w-0 md:grid md:h-dvh md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden">
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur md:static" aria-label="Shop Admin controls">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 md:px-5 xl:px-6">
            <div className="md:hidden"><AdminBrand compact /></div>
            <div className="ml-auto flex items-center gap-2">
              <AdminLocaleSwitcher locale={locale} messages={messages} />
              <AppHeaderActions />
            </div>
          </div>
          <nav className="grid grid-cols-3 gap-2 px-4 pb-3 md:hidden" aria-label={messages.mobileNavigation}>
            {activeNavigation.map(({ message, icon: Icon, href }) => {
              const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
              return <Button key={href} asChild variant={active ? 'secondary' : 'ghost'} size="sm" className="w-full min-w-0">
                <Link href={href} aria-current={active ? 'page' : undefined}><Icon aria-hidden="true" className="size-4" />{messages[message]}</Link>
              </Button>;
            })}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-5 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:py-6 xl:px-6">{children}</main>
      </div>
    </div>
  );
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <Image src="/ltl-logo.png" alt="Lightning Transport and Logistics" width={1536} height={894} priority className={compact ? 'h-auto w-12 sm:w-16' : 'h-auto w-[4.5rem]'} />
      {!compact ? <div><p className="font-display text-sm font-bold tracking-wide">LTL SHOP</p><p className="text-xs text-muted-foreground">ADMIN</p></div> : null}
    </div>
  );
}
