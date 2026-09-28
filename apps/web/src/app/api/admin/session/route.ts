import { NextRequest, NextResponse } from 'next/server';
import type { UserDto } from '@ltl-shop/shared';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, apiBaseUrl } from '@/lib/admin-session';
import { adminSessionCookieSecure } from '@/lib/dev-login';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Missing authorization token' }, { status: 401 });
  }

  const response = await fetch(`${apiBaseUrl()}/api/auth/me`, {
    headers: { authorization },
    cache: 'no-store',
  });
  if (!response.ok) {
    (await cookies()).delete(ADMIN_SESSION_COOKIE);
    return NextResponse.json({ message: 'Unable to establish server session' }, { status: response.status });
  }

  const body = (await response.json()) as { user: UserDto };
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, authorization.slice('Bearer '.length), {
    httpOnly: true,
    sameSite: 'lax',
    secure: adminSessionCookieSecure(process.env.NODE_ENV, process.env.NEXT_PUBLIC_E2E_DEV_LOGIN),
    path: '/',
    maxAge: 60 * 60,
  });

  return NextResponse.json({ user: body.user });
}

export async function DELETE() {
  (await cookies()).delete(ADMIN_SESSION_COOKIE);
  return new NextResponse(null, { status: 204 });
}
