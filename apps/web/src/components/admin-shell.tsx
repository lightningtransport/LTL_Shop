'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ClipboardList, Gauge, History, Library, ListChecks, Menu, Truck, UsersRound, Warehouse } from 'lucide-react';
import { AdminNavLink } from './admin-nav-link';
import { AppHeaderActions, Button, Modal } from './ui';
import { AdminActorProvider } from '@/lib/admin-actor';
import type { AdminMessages } from '@/lib/admin-messages';

// LTR-122: daily operation first, then setup, then audit (same pages for every role).
const navigationGroups = [
  {
    title: 'navGroupOperations',
    items: [
      { message: 'dashboard', icon: Gauge, href: '/admin' },
      { message: 'yardOperations', icon: Warehouse, href: '/admin/yard-operations' },
      { message: 'workOrders', icon: ClipboardList, href: '/admin/work-orders' },
      { message: 'trucks', icon: Truck, href: '/admin/trucks' },
    ],
  },
  {
    title: 'navGroupSetup',
    items: [
      { message: 'mechanics', icon: UsersRound, href: '/admin/mechanics' },
      { message: 'jobCatalog', icon: Library, href: '/admin/catalog' },
      { message: 'shopWorkflow', icon: ListChecks, href: '/admin/setup/workflow' },
    ],
  },
  {
    title: 'navGroupAudit',
    items: [
      { message: 'history', icon: History, href: '/admin/history' },
    ],
  },
] as const;

function isActivePath(pathname: string, href: string) {
  return href === '/admin' ? pathname === href : pathname.startsWith(href);
}

export function AdminShell({
  children,
  messages,
  user,
}: {
  children: React.ReactNode;
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
    <AdminActorProvider role={user.role}>
    <div className="app-safe-x app-safe-bottom flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background [--admin-aside:0px] md:[--admin-aside:15rem]">
      <header
        className="app-safe-top sticky top-0 z-40 w-full shrink-0 border-b bg-card/95 backdrop-blur"
        aria-label={messages.shellControls}
      >
        <div className="flex h-14 w-full min-w-0 items-center gap-2 px-4 md:gap-3 md:px-5 xl:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              aria-label={mobileNavOpen ? messages.closeMobileNavigation : messages.openMobileNavigation}
              aria-expanded={mobileNavOpen}
              aria-controls="admin-mobile-navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu aria-hidden="true" className="size-5" />
            </Button>
            <AdminBrand />
          </div>
          {/* LTR-167: language and theme are in the profile menu, same as the mechanic header. */}
          <div className="ml-auto flex shrink-0 items-center">
            <AppHeaderActions />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 w-full min-w-0 flex-1">
        <aside
          className="hidden h-full min-h-0 w-[var(--admin-aside)] shrink-0 flex-col overflow-hidden border-r bg-card px-3 py-4 md:flex xl:px-4"
          aria-label={messages.navigation}
        >
          <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
            {navigationGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-3 text-xs font-semibold text-muted-foreground">{messages[group.title]}</p>
                {group.items.map(({ message, icon: Icon, href }) => {
                  const active = isActivePath(pathname, href);
                  return <Button key={href} asChild variant={active ? 'secondary' : 'ghost'} className="w-full justify-start">
                    <AdminNavLink href={href} aria-current={active ? 'page' : undefined}>
                      <Icon aria-hidden="true" className="size-4" />{messages[message]}
                    </AdminNavLink>
                  </Button>;
                })}
              </div>
            ))}
          </nav>
          <div className="mt-3 shrink-0 border-t px-1 pt-4 text-sm">
            <p className="truncate font-medium">{user.name}</p>
            <p className="mt-1 capitalize text-muted-foreground">{user.role}</p>
          </div>
        </aside>

        <main className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full min-w-0 max-w-[1500px] px-4 py-5 sm:px-5 md:py-6 xl:px-6">{children}</div>
        </main>
      </div>

      <Modal
        open={mobileNavOpen}
        title={messages.navigation}
        onClose={() => setMobileNavOpen(false)}
        returnFocusRef={menuButtonRef}
        closeLabel={messages.closeMobileNavigation}
      >
        <nav
          id="admin-mobile-navigation"
          className="flex flex-col gap-1"
          aria-label={messages.mobileNavigation}
        >
          {navigationGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1 pb-2">
              <p className="px-3 pt-1 text-xs font-semibold text-muted-foreground">{messages[group.title]}</p>
              {group.items.map(({ message, icon: Icon, href }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Button
                    key={href}
                    asChild
                    variant={active ? 'secondary' : 'ghost'}
                    className="h-11 w-full min-h-11 justify-start"
                  >
                    <AdminNavLink
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <Icon aria-hidden="true" className="size-4" />{messages[message]}
                    </AdminNavLink>
                  </Button>
                );
              })}
            </div>
          ))}
        </nav>
      </Modal>
    </div>
    </AdminActorProvider>
  );
}

function AdminBrand() {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <Image
        src="/ltl-logo.png"
        alt="Lightning Transport and Logistics"
        width={1536}
        height={894}
        priority
        className="h-8 w-12 shrink-0 object-contain sm:h-9 sm:w-14"
      />
      <p className="hidden min-w-0 truncate font-display text-sm font-bold sm:block">
        LTL SHOP
        <span className="ml-2 text-xs font-medium text-muted-foreground">Admin</span>
      </p>
    </div>
  );
}
