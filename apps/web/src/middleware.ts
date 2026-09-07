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
  const login = new URL('/login', request.url);
  login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/admin/:path*'],
};
