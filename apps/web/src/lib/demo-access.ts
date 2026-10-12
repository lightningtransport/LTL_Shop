import { DEMO_HOSTED } from './dev-login';

/**
 * D39 (DP3): the access code of the published demo. The visitor types the code that came with the link; the browser
 * keeps it and sends it on every request, and the API refuses any `dev:` request without it. Outside the published
 * demo build this adds nothing.
 */
export const DEMO_ACCESS_HEADER = 'x-demo-access';
const DEMO_ACCESS_KEY = 'ltl_demo_access';
/** Server copy for the Admin middleware, which calls the API on its own (set by /api/admin/session). */
export const DEMO_ACCESS_COOKIE = 'ltl_demo_access';

/** Fallback when storage is blocked: the code lives for this page only. */
let inMemory: string | null = null;

export function readDemoAccess(): string | null {
  try {
    return window.localStorage.getItem(DEMO_ACCESS_KEY) ?? inMemory;
  } catch {
    return inMemory;
  }
}

export function writeDemoAccess(code: string | null): void {
  inMemory = code;
  try {
    if (code) window.localStorage.setItem(DEMO_ACCESS_KEY, code);
    else window.localStorage.removeItem(DEMO_ACCESS_KEY);
  } catch {
    // Storage blocked: kept in memory above (the gate asks again on the next load).
  }
}

/** Headers for a browser request to the API or to /api/admin/session. */
export function demoAccessHeaders(): Record<string, string> {
  if (!DEMO_HOSTED) return {};
  const code = readDemoAccess();
  return code ? { [DEMO_ACCESS_HEADER]: code } : {};
}
