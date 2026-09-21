'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps, MouseEvent } from 'react';
import { hrefString, shouldClientNavigate } from '@/lib/admin-nav';

type AdminNavLinkProps = ComponentProps<typeof Link>;

/**
 * Admin shell / dashboard links. Prefetch is off so an in-flight RSC prefetch
 * cannot leave the first click non-navigable. Unmodified left-clicks go through
 * router.push so the first gesture always navigates.
 */
export function AdminNavLink({ href, onClick, prefetch = false, ...props }: AdminNavLinkProps) {
  const router = useRouter();
  const destination = hrefString(
    typeof href === 'string' ? href : { pathname: href.pathname ?? '/', search: href.search ?? '' },
  );

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (!shouldClientNavigate(event)) return;
        event.preventDefault();
        router.push(destination);
      }}
    />
  );
}
