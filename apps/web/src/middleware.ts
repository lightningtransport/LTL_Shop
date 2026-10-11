import { NextRequest, NextResponse } from 'next/server';
import type { UserDto } from '@ltl-shop/shared';
import { ADMIN_SESSION_COOKIE, apiBaseUrl } from '@/lib/admin-session';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return loginRedirect(request);

  try {
    const response = await fetch(`${apiBaseUrl()}/api/admin/access`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (response.status === 403) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-ltl-admin-denied', 'true');
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    if (!response.ok) {
      const redirect = loginRedirect(request);
      redirect.cookies.delete(ADMIN_SESSION_COOKIE);
      return redirect;
    }

    const { user } = (await response.json()) as { user: UserDto };
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-ltl-admin-name', encodeURIComponent(user.name));
    requestHeaders.set('x-ltl-admin-role', user.role);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return NextResponse.json(
      { message: 'Shop Admin authorization is temporarily unavailable.' },
      { status: 503 },
    );
  }
}

function loginRedirect(request: NextRequest) {
  // Build the redirect from the Host the browser sent (behind a proxy, x-forwarded-host), not from
  // `request.url`: in `next dev` that one carries the server's own hostname. Note that the dev server still
  // rewrites an absolute Location to its hostname, so the local demo is opened at http://localhost:3042
  // (docs/reference/DEMO.md), never at 127.0.0.1, or a bounce lands on another origin (UX-1-003).
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
  const login = new URL('/login', `${request.nextUrl.protocol}//${host}`);
  login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/admin/:path*'],
};
