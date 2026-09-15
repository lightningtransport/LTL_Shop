import { trackEvent } from './observability';

export const AUTH_TOKEN_KEY = 'ltl_shop_token';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function resolveAuthToken() {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(AUTH_TOKEN_KEY);
    if (saved) {
      authToken = saved;
      return saved;
    }
  }
  return null;
}

export function getAuthToken() {
  return resolveAuthToken();
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  body: unknown;
  kind: 'http' | 'network' | 'timeout';
  route: string;
  method: string;
  constructor(
    message: string,
    status: number,
    body: unknown,
    kind: 'http' | 'network' | 'timeout' = 'http',
    route = 'unknown',
    method = 'GET',
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.kind = kind;
    this.route = route;
    this.method = method;
  }
}

export type ApiFetchOptions = RequestInit & {
  /** Defaults to 8s for reads and 15s for mutations. */
  timeoutMs?: number;
};

/** Client GET budget. API cold TTFB above this still needs an Eng/API fix. */
export const API_GET_TIMEOUT_MS = 8_000;
export const API_MUTATION_TIMEOUT_MS = 15_000;
/** Longer timeout on automatic retries so a waking API can finish after the first 8s abort. */
export const API_RETRY_GET_TIMEOUT_MS = 15_000;
export const TRANSIENT_RETRY_DELAYS_MS = [400, 1_200] as const;

function defaultTimeout(method?: string) {
  return !method || method.toUpperCase() === 'GET' ? API_GET_TIMEOUT_MS : API_MUTATION_TIMEOUT_MS;
}

export function isTransientApiError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.kind === 'network' || error.kind === 'timeout') return true;
  return [408, 425, 429, 500, 502, 503, 504].includes(error.status);
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * SWR fetcher: GET-only backoff for cold start / network blips.
 * Mutations stay single-shot. Exhausted retries still throw so LoadFailure + Retry remain.
 */
export async function apiFetchWithRetry<T>(
  path: string,
  init: ApiFetchOptions = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const retryDelays = method === 'GET' ? TRANSIENT_RETRY_DELAYS_MS : [];
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      const timeoutMs =
        init.timeoutMs ?? (attempt === 0 ? defaultTimeout(init.method) : API_RETRY_GET_TIMEOUT_MS);
      return await apiFetch<T>(path, { ...init, timeoutMs });
    } catch (error) {
      lastError = error;
      const delay = retryDelays[attempt];
      if (init.signal?.aborted || delay === undefined || !isTransientApiError(error)) {
        throw error;
      }
      await sleep(delay, init.signal ?? undefined);
    }
  }

  throw lastError;
}

export function endpointFamily(path: string) {
  const pathname = path.split('?')[0] ?? path;
  if (/^\/api\/work-orders\/[^/]+\/jobs\/[^/]+/.test(pathname)) {
    return '/api/work-orders/:id/jobs/:jobId';
  }
  if (/^\/api\/work-orders\/[^/]+/.test(pathname)) {
    return pathname.replace(/^\/api\/work-orders\/[^/]+/, '/api/work-orders/:id');
  }
  if (/^\/api\/trucks\/[^/]+/.test(pathname)) {
    return pathname.replace(/^\/api\/trucks\/[^/]+/, '/api/trucks/:id');
  }
  if (/^\/api\/admin\/trucks\/[^/]+/.test(pathname)) {
    return pathname.replace(/^\/api\/admin\/trucks\/[^/]+/, '/api/admin/trucks/:id');
  }
  return pathname;
}

function errorMessage(body: unknown, status: number) {
  if (typeof body === 'object' && body !== null) {
    const candidate = body as { message?: unknown; error?: unknown };
    const message = candidate.message ?? candidate.error;
    if (Array.isArray(message)) return message.join(', ');
    if (message) return String(message);
  }
  return typeof body === 'string' ? body : `Request failed (${status})`;
}

export async function apiFetch<T>(
  path: string,
  init: ApiFetchOptions = {},
): Promise<T> {
  const { timeoutMs = defaultTimeout(init.method), signal: callerSignal, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  headers.set('Content-Type', 'application/json');
  const token = resolveAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal) {
    if (callerSignal.aborted) abortFromCaller();
    else callerSignal.addEventListener('abort', abortFromCaller, { once: true });
  }
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const startedAt = performance.now();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...requestInit,
      headers,
      signal: controller.signal,
    });
  } catch {
    const durationMs = Math.round(performance.now() - startedAt);
    const kind = timedOut ? 'timeout' : 'network';
    const route = endpointFamily(path);
    const method = requestInit.method ?? 'GET';
    trackEvent('api_request_failed', {
      route,
      method,
      kind,
      durationMs,
    });
    throw new ApiError(
      timedOut ? 'The request took too long. Please try again.' : 'Unable to reach the Shop. Please try again.',
      0,
      null,
      kind,
      route,
      method,
    );
  } finally {
    window.clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      authToken = null;
      window.dispatchEvent(new Event('ltl-auth-expired'));
    }
    const message = errorMessage(body, res.status);
    const route = endpointFamily(path);
    const method = requestInit.method ?? 'GET';
    trackEvent('api_request_failed', {
      route,
      method,
      kind: 'http',
      status: res.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw new ApiError(message, res.status, body, 'http', route, method);
  }
  trackEvent('api_request_completed', {
    route: endpointFamily(path),
    method: requestInit.method ?? 'GET',
    status: res.status,
    durationMs: Math.round(performance.now() - startedAt),
  });
  return body as T;
}
