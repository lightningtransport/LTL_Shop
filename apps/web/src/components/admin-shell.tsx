'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Gauge, History, Library, Menu, Truck, UsersRound, Warehouse } from 'lucide-react';
import { AdminLocaleSwitcher } from './admin-locale-switcher';
import { AppHeaderActions } from './ui';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

const activeNavigation = [
  { message: 'dashboard', icon: Gauge, href: '/admin' },
  { message: 'workOrders', icon: ClipboardList, href: '/admin/work-orders' },
  { message: 'yardOperations', icon: Warehouse, href: '/admin/yard-operations' },
  { message: 'trucks', icon: Truck, href: '/admin/trucks' },
  { message: 'mechanics', icon: UsersRound, href: '/admin/mechanics' },
  { message: 'jobCatalog', icon: Library, href: '/admin/catalog' },
  { message: 'history', icon: History, href: '/admin/history' },
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="app-safe-x app-safe-bottom min-h-dvh bg-background md:grid md:h-dvh md:grid-cols-[220px_minmax(0,1fr)] md:overflow-hidden xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="app-safe-top hidden h-dvh min-h-0 border-r bg-card px-3 py-4 md:flex md:flex-col xl:px-4" aria-label={messages.navigation}>
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
        </nav>
        <div className="mt-3 shrink-0 border-t px-1 pt-4 text-sm">
          <p className="truncate font-medium">{user.name}</p>
          <p className="mt-1 capitalize text-muted-foreground">{user.role}</p>
        </div>
      </aside>

      <div className="min-w-0 md:grid md:h-dvh md:min-h-0 md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden">
        <header className="app-safe-top sticky top-0 z-40 border-b bg-card/95 backdrop-blur md:static" aria-label="Shop Admin controls">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 md:px-5 xl:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <Button
                ref={menuButtonRef}
                variant="ghost"
                size="icon"
                aria-label={mobileNavOpen ? messages.closeMobileNavigation : messages.openMobileNavigation}
                aria-expanded={mobileNavOpen}
                aria-controls="admin-mobile-navigation"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu aria-hidden="true" className="size-5" />
              </Button>
              <AdminBrand compact />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <AdminLocaleSwitcher locale={locale} messages={messages} />
              <AppHeaderActions />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-5 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:py-6 xl:px-6">{children}</main>
      </div>

      <Sheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
      >
        <SheetContent
          side="bottom"
          closeLabel={messages.closeMobileNavigation}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            menuButtonRef.current?.focus();
          }}
        >
        <SheetHeader className="mb-4">
          <SheetTitle>{messages.navigation}</SheetTitle>
          <SheetDescription className="sr-only">{messages.mobileNavigation}</SheetDescription>
        </SheetHeader>
        <nav
          id="admin-mobile-navigation"
          className="flex flex-col gap-1"
          aria-label={messages.mobileNavigation}
        >
          {activeNavigation.map(({ message, icon: Icon, href }) => {
            const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
            return (
              <Button
                key={href}
                asChild
                variant={active ? 'secondary' : 'ghost'}
                className="h-11 w-full min-h-11 justify-start"
              >
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Icon aria-hidden="true" className="size-4" />{messages[message]}
                </Link>
              </Button>
            );
          })}
        </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-h-10 shrink-0 items-center gap-3">
      <Image
        src="/ltl-logo.png"
        alt="Lightning Transport and Logistics"
        width={1536}
        height={894}
        priority
        className={compact ? 'h-8 w-12 object-contain sm:h-9 sm:w-14' : 'h-10 w-16 object-contain'}
      />
      {!compact ? (
        <div className="leading-none">
          <p className="font-display text-sm font-bold tracking-wide">LTL SHOP</p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
        </div>
      ) : null}
    </div>
  );
}
