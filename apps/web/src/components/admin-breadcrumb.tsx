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

/**
 * PCA11 (UX-5-006): the browser tab says which screen it is ("FP-48840 · FleetPride — Purchases"), so two tabs with two
 * purchases can be told apart. Restores the layout's title when the screen closes.
 */
/**
 * LTR-293 §10: every open screen names the browser tab. On a full page load Next.js writes the layout's title after
 * this runs, so the title is kept: one shared stack (the screen mounted last wins, so two hooks never fight) and one
 * observer on <head> that puts it back if something else changes it.
 */
const titleStack: Array<{ id: number; title: string }> = [];
let titleObserver: MutationObserver | null = null;
let titleFallback = '';
let nextTitleId = 0;

function applyTitle() {
  const top = titleStack[titleStack.length - 1];
  const want = top ? `${top.title} — Lightning Shop` : titleFallback;
  if (want && document.title !== want) document.title = want;
}

export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (!title) return undefined;
    const id = ++nextTitleId;
    if (!titleStack.length) titleFallback = document.title;
    titleStack.push({ id, title });
    if (!titleObserver && typeof MutationObserver !== 'undefined') {
      titleObserver = new MutationObserver(applyTitle);
      titleObserver.observe(document.head, { subtree: true, childList: true, characterData: true });
    }
    applyTitle();
    return () => {
      const at = titleStack.findIndex((entry) => entry.id === id);
      if (at >= 0) titleStack.splice(at, 1);
      if (!titleStack.length) {
        titleObserver?.disconnect();
        titleObserver = null;
      }
      applyTitle();
    };
  }, [title]);
}

/** A detail page names itself in the top bar while it is open, e.g. `[{ label: 'Work Orders', href }, { label: 'WO-010' }]`. */
export function useAdminBreadcrumb(crumbs: Crumb[] | null) {
  const context = useContext(BreadcrumbContext);
  // LTR-293 §10: a detail page also names the browser tab ("WO-017 — Lightning Shop"), so several open ones differ.
  useDocumentTitle(crumbs?.[crumbs.length - 1]?.label ?? null);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    if (!context) return undefined;
    context.setCrumbs(crumbs);
    return () => context.setCrumbs(null);
    // `key` stands for `crumbs` (a new array every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
