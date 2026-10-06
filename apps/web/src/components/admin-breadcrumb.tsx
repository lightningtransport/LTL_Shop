'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Crumb = { label: string; href?: string };

const BreadcrumbContext = createContext<{ crumbs: Crumb[] | null; setCrumbs: (crumbs: Crumb[] | null) => void } | null>(null);

/** Stage 8 (F6, mockups): the top bar's breadcrumb ("Work Orders › WO-010"). Pages set theirs; the shell reads it. */
export function AdminBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null);
  return <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>{children}</BreadcrumbContext.Provider>;
}

export function useAdminCrumbs() {
  return useContext(BreadcrumbContext)?.crumbs ?? null;
}

/** A detail page names itself in the top bar while it is open, e.g. `[{ label: 'Work Orders', href }, { label: 'WO-010' }]`. */
export function useAdminBreadcrumb(crumbs: Crumb[] | null) {
  const context = useContext(BreadcrumbContext);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    if (!context) return undefined;
    context.setCrumbs(crumbs);
    return () => context.setCrumbs(null);
    // `key` stands for `crumbs` (a new array every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
