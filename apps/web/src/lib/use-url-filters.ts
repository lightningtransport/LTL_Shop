'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type FilterValue = string | boolean;

/**
 * PCA1 (UX-5-001): the filters of a Parts & costs list live in the URL, like Trucks, Work Orders and History, so
 * Back from a detail, a reload and a shared link keep them. `defaults` must be a module-level constant: its keys are
 * the only query parameters the hook reads and writes, and anything else in the address (`new`, `from`…) is left as is.
 */
export function useUrlFilters<T extends Record<string, FilterValue>>(defaults: T) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const out: Record<string, FilterValue> = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const raw = searchParams.get(key);
      if (raw === null) continue;
      out[key] = typeof defaults[key] === 'boolean' ? raw === '1' || raw === 'true' : raw;
    }
    return out as T;
  }, [defaults, searchParams]);

  const replace = useCallback(
    (next: URLSearchParams) => router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false }),
    [router, pathname],
  );

  const set = useCallback(
    <K extends keyof T & string>(key: K, value: T[K]) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === '' || value === false) next.delete(key);
      else next.set(key, value === true ? '1' : String(value));
      replace(next);
    },
    [searchParams, replace],
  );

  /** Several filters at once (the phone's Filters sheet applies them together). */
  const setMany = useCallback(
    (values: Partial<T>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) continue;
        if (value === '' || value === false) next.delete(key);
        else next.set(key, value === true ? '1' : String(value));
      }
      replace(next);
    },
    [searchParams, replace],
  );

  const clear = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of Object.keys(defaults)) next.delete(key);
    replace(next);
  }, [defaults, searchParams, replace]);

  /** What goes to the API: only the filter keys, trimmed, booleans as `true`. */
  const query = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === true) params.set(key, 'true');
      else if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
    }
    return params.toString();
  }, [filters]);

  /** The list's own address with its filters, for `?from=` on the links out of it. */
  const here = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === true) params.set(key, '1');
      else if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
    }
    return `${pathname}${params.size ? `?${params}` : ''}`;
  }, [filters, pathname]);

  return { filters, set, setMany, clear, query, here, active: Boolean(query) };
}

/**
 * A text field bound to a URL filter: typing stays local and reaches the address (and the API) after a pause, so a
 * search of ten letters is one navigation, not ten. Changes that come from the URL (Back, Clear) flow back in.
 */
export function useDebouncedFilterText(value: string, commit: (next: string) => void, delay = 300) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
    setDraft(value);
  }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onChange = useCallback(
    (next: string) => {
      setDraft(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (next !== latest.current) commit(next);
      }, delay);
    },
    [commit, delay],
  );
  return [draft, onChange] as const;
}
