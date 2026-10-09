'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Building2, ChevronLeft, Clock, ChevronRight, ClipboardCheck, ClipboardList, Gauge, History, Library, ListChecks, Menu, Package, Receipt, Store, Truck, UsersRound, Warehouse, Wrench } from 'lucide-react';
import { AppCapability } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { AdminNavLink } from './admin-nav-link';
import { AdminBreadcrumbProvider, useAdminCrumbs, type Crumb } from './admin-breadcrumb';
import { AppHeaderActions, Button, Modal } from './ui';
import { AdminActorProvider, useCanShowManagerWrites } from '@/lib/admin-actor';
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
    // LTR-200 / D32, D-PC7: money, so only the Shop Manager and the System Admin see it.
    title: 'navGroupPartsCosts',
    managerOnly: true,
    items: [
      { message: 'pcPurchases', icon: Receipt, href: '/admin/parts/purchases' },
      { message: 'pcOutsideRepairs', icon: Building2, href: '/admin/parts/outside-repairs' },
      { message: 'pcParts', icon: Package, href: '/admin/parts/catalog' },
      { message: 'pcVendors', icon: Store, href: '/admin/parts/vendors' },
      { message: 'pcLaborRate', icon: Clock, href: '/admin/parts/labor-rate' },
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
  return (
    <AdminActorProvider role={user.role}>
      <AdminBreadcrumbProvider>
        <ShellFrame messages={messages} user={user}>{children}</ShellFrame>
      </AdminBreadcrumbProvider>
    </AdminActorProvider>
  );
}

const NAV_ITEM = 'flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-sm [@media(pointer:fine)]:min-h-9';

/**
 * Stage 8 (F6, mockups): the sidebar runs the full height with the brand on top, the top bar beside it holds
 * the breadcrumb, and the page content is `text-sm` on the page background (no glow). Phones: a menu button
 * opens the navigation as a sheet.
 */
function ShellFrame({ children, messages, user }: { children: React.ReactNode; messages: AdminMessages; user: { name: string; role: string } }) {
  const pathname = usePathname();
  const canSeeManagerGroups = useCanShowManagerWrites();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pageCrumbs = useAdminCrumbs();
  const navItems: ReadonlyArray<{ message: (typeof navigationGroups)[number]['items'][number]['message']; href: string }> = navigationGroups.flatMap((group) => [...group.items]);
  const activeItem = navItems.find((item) => isActivePath(pathname, item.href));
  const crumbs: Crumb[] = pageCrumbs ?? (activeItem ? [{ label: messages[activeItem.message] }] : []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // P4 (owner, 2026-10-06): the mechanic workspaces are a sidebar group, only for people who also wrench.
  const { user: authUser } = useAuth();
  const workspaces: Array<{ href: string; label: string; icon: typeof Wrench }> = [];
  if (authUser?.capabilities.includes(AppCapability.MECHANIC_STANDARD)) workspaces.push({ href: '/mechanic/standard', label: messages.standardWorkspace, icon: Wrench });
  if (authUser?.capabilities.includes(AppCapability.MECHANIC_PM)) workspaces.push({ href: '/mechanic/pm', label: messages.pmWorkspace, icon: ClipboardCheck });

  const navGroups = (onNavigate?: () => void) => [...navigationGroups.filter((group) => !('managerOnly' in group) || canSeeManagerGroups).map((group) => (
    <div key={group.title} className="space-y-0.5">
      <p className="px-2 pb-1 text-xs text-muted-foreground">{messages[group.title]}</p>
      {group.items.map(({ message, icon: Icon, href }) => {
        const active = isActivePath(pathname, href);
        return (
          <AdminNavLink
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={`${NAV_ITEM} ${active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />{messages[message]}
          </AdminNavLink>
        );
      })}
    </div>
  )), workspaces.length ? (
    <div key="workspaces" className="space-y-0.5" data-testid="admin-nav-workspaces">
      <p className="px-2 pb-1 text-xs text-muted-foreground">{messages.workspaces}</p>
      {workspaces.map(({ href, label, icon: Icon }) => (
        <AdminNavLink key={href} href={href} onClick={onNavigate} className={`${NAV_ITEM} text-muted-foreground hover:bg-accent hover:text-foreground`}>
          <Icon aria-hidden="true" className="size-4 shrink-0" />{label}
        </AdminNavLink>
      ))}
    </div>
  ) : null];

  return (
    <div className="app-safe-x flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-background text-sm [--admin-aside:0px] md:[--admin-aside:15rem]">
      <aside
        className="app-safe-top hidden h-full min-h-0 w-[var(--admin-aside)] shrink-0 flex-col border-r bg-background md:flex"
        aria-label={messages.navigation}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <AdminBrand />
        </div>
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-3">
          {navGroups()}
        </nav>
        {/* LTR-179 (U4): installed on an iPad, the name/role block stays above the home indicator. */}
        <div className="shrink-0 border-t p-3 pb-[calc(0.75rem+var(--app-safe-bottom))]">
          <p className="truncate font-medium">{user.name}</p>
          <p className="text-xs capitalize text-muted-foreground">{user.role}</p>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className="app-safe-top sticky top-0 z-40 w-full shrink-0 border-b bg-background/90 backdrop-blur"
          aria-label={messages.shellControls}
        >
          <div className="flex h-14 w-full min-w-0 items-center justify-between gap-3 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-1">
              <Button
                ref={menuButtonRef}
                variant="ghost"
                size="icon"
                className="-ml-2 shrink-0 md:hidden"
                aria-label={mobileNavOpen ? messages.closeMobileNavigation : messages.openMobileNavigation}
                aria-expanded={mobileNavOpen}
                aria-controls="admin-mobile-navigation"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu aria-hidden="true" className="size-5" />
              </Button>
              {crumbs.length ? (
                <nav aria-label={messages.breadcrumbLabel} className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-muted-foreground" data-testid="admin-breadcrumb">
                  {crumbs.map((crumb, index) => {
                    const last = index === crumbs.length - 1;
                    // Phones: only the parent, as a back link ("‹ T-102"); a single crumb stays as it is.
                    const parent = index === crumbs.length - 2;
                    const phoneHidden = crumbs.length > 1 ? !parent : false;
                    return (
                      <span key={`${crumb.label}-${index}`} className={`flex min-w-0 items-center gap-1.5 ${phoneHidden ? 'max-sm:hidden' : ''}`}>
                        {parent ? <ChevronLeft aria-hidden="true" className="size-4 shrink-0 sm:hidden" /> : null}
                        {index > 0 ? <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 max-sm:hidden" /> : null}
                        {crumb.href && !last ? (
                          <AdminNavLink href={crumb.href} className="tap-inline truncate hover:text-foreground">{crumb.label}</AdminNavLink>
                        ) : (
                          <span className={`truncate ${last ? 'font-medium text-foreground' : ''}`} aria-current={last ? 'page' : undefined}>{crumb.label}</span>
                        )}
                      </span>
                    );
                  })}
                </nav>
              ) : null}
            </div>
            {/* LTR-167: language and theme are in the profile menu, same as the mechanic header. */}
            <div className="flex shrink-0 items-center">
              <AppHeaderActions />
            </div>
          </div>
        </header>

        <main className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain">
          {/* LTR-171: the home-indicator space is inside the scroller, so cards scroll under it instead of the
              page ending early above a flat band. */}
          <div className="mx-auto w-full min-w-0 max-w-[1440px] px-4 pb-[calc(1.5rem+var(--app-safe-bottom))] pt-6 md:px-6">{children}</div>
        </main>
      </div>

      <Modal
        open={mobileNavOpen}
        title={messages.navigation}
        onClose={() => setMobileNavOpen(false)}
        returnFocusRef={menuButtonRef}
        closeLabel={messages.closeMobileNavigation}
      >
        <nav id="admin-mobile-navigation" className="space-y-5" aria-label={messages.mobileNavigation}>
          {navGroups(() => setMobileNavOpen(false))}
        </nav>
      </Modal>
    </div>
  );
}

function AdminBrand() {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Image
        src="/ltl-logo.png"
        alt="Lightning Transport and Logistics"
        width={1536}
        height={894}
        priority
        className="h-7 w-11 shrink-0 object-contain"
      />
      <span className="truncate font-semibold">LTL Shop</span>
      <span className="text-xs text-muted-foreground">Admin</span>
    </div>
  );
}
