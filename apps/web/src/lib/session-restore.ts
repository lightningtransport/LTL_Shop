export const SESSION_RESTORE_TIMEOUT_MS = 5_000;
export const PROFILE_RESTORE_TIMEOUT_MS = 8_000;

export async function withDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Session restoration timed out. Please try again.',
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function fetchWithDeadline(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal) {
    if (callerSignal.aborted) abortFromCaller();
    else callerSignal.addEventListener('abort', abortFromCaller, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export type StandaloneProbe = {
  navigator: { standalone?: boolean };
  matchMedia?: (query: string) => Pick<MediaQueryList, 'matches'>;
};

export type DisplayWindow = StandaloneProbe & {
  location: Pick<Location, 'pathname' | 'search' | 'replace'>;
};

export function isStandaloneDisplay(win: StandaloneProbe = window as unknown as StandaloneProbe): boolean {
  if (win.navigator.standalone === true) return true;
  return (
    win.matchMedia?.('(display-mode: standalone)').matches === true ||
    win.matchMedia?.('(display-mode: fullscreen)').matches === true
  );
}

export function currentAppPath(win: Pick<DisplayWindow, 'location'> = window as unknown as DisplayWindow): string {
  return `${win.location.pathname}${win.location.search}`;
}

/** Full navigation in iOS/home-screen standalone — Next client redirects can hang there. */
export function replaceAppLocation(
  path: string,
  router?: { replace: (href: string, options?: { scroll?: boolean }) => void },
  options?: { scroll?: boolean },
  win: DisplayWindow | undefined = typeof window === 'undefined' ? undefined : (window as unknown as DisplayWindow),
): void {
  if (!win?.location) {
    router?.replace(path, options);
    return;
  }
  if (currentAppPath(win) === path) return;
  if (isStandaloneDisplay(win)) {
    win.location.replace(path);
    return;
  }
  router?.replace(path, options);
}
