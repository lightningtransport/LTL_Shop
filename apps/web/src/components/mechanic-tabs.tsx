'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, History, Wrench } from 'lucide-react';
import { MechanicMode } from '@ltl-shop/shared';
import { useShopLocale } from '@/lib/locale-context';
import { cn } from '@/lib/utils';

/**
 * LTR-133: one navigation for both mechanic workspaces (Standard and PM):
 * My work · Trucks (search + repair history) · Completed.
 */
export function MechanicTabs({ mode }: { mode: MechanicMode }) {
  const { messages } = useShopLocale();
  const pathname = usePathname();
  const base = `/mechanic/${mode === MechanicMode.PM ? 'pm' : 'standard'}`;
  const tabs = [
    { href: base, label: messages.navMyWork, Icon: Wrench },
    { href: `${base}/trucks`, label: messages.navTrucks, Icon: History },
    { href: `${base}/completed`, label: messages.navCompleted, Icon: ClipboardCheck },
  ];
  return (
    // D-MG1: on phones the tabs sit at the bottom, within the thumb's reach; from `sm` they stay on top.
    <nav
      aria-label={messages.mechanicNavLabel}
      data-bottom-tabs=""
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t bg-card pb-[var(--app-safe-bottom)] sm:static sm:mb-4 sm:gap-1 sm:rounded-xl sm:border sm:p-1"
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 text-xs font-medium transition sm:min-h-11 sm:flex-row sm:gap-1.5 sm:rounded-lg sm:text-sm',
              active
                ? 'text-primary sm:bg-primary sm:text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground sm:hover:bg-accent',
            )}
          >
            <Icon aria-hidden="true" className="size-5 sm:size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
