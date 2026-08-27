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
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = resolveAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      authToken = null;
      window.dispatchEvent(new Event('ltl-auth-expired'));
    }
    const message =
      body?.message ??
      body?.error ??
      (typeof body === 'string' ? body : `Request failed (${res.status})`);
    throw new ApiError(
      Array.isArray(message) ? message.join(', ') : String(message),
      res.status,
      body,
    );
  }
  return body as T;
}
