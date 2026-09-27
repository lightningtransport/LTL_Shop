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
    <nav aria-label={messages.mechanicNavLabel} className="mb-4 grid grid-cols-3 gap-1 rounded-xl border bg-card p-1">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
