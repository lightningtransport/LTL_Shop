import { NextRequest, NextResponse } from 'next/server';
import type { UserDto } from '@ltl-shop/shared';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, apiBaseUrl } from '@/lib/admin-session';
import { adminSessionCookieSecure } from '@/lib/dev-login';
import { DEMO_ACCESS_COOKIE, DEMO_ACCESS_HEADER } from '@/lib/demo-access';
import { AppCapability } from '@ltl-shop/shared';
import { ADMIN_PROFILE_COOKIE, ADMIN_PROFILE_MAX_AGE_SECONDS, adminProfileSecret, signAdminProfile } from '@/lib/admin-profile-cookie';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Missing authorization token' }, { status: 401 });
  }

  // D39 (DP3): the published demo's access code travels with the request; the API checks it.
  const demoAccess = request.headers.get(DEMO_ACCESS_HEADER);
  const response = await fetch(`${apiBaseUrl()}/api/auth/me`, {
    headers: demoAccess ? { authorization, [DEMO_ACCESS_HEADER]: demoAccess } : { authorization },
    cache: 'no-store',
  });
  if (!response.ok) {
    const store = await cookies();
    store.delete(ADMIN_SESSION_COOKIE);
    store.delete(ADMIN_PROFILE_COOKIE);
    return NextResponse.json({ message: 'Unable to establish server session' }, { status: response.status });
  }

  const body = (await response.json()) as { user: UserDto };
  const cookieStore = await cookies();
  const token = authorization.slice('Bearer '.length);
  const secure = adminSessionCookieSecure(process.env.NODE_ENV, process.env.NEXT_PUBLIC_E2E_DEV_LOGIN);
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60,
  });
  // The Admin middleware calls the API without the browser: it reads the code from here.
  if (demoAccess) cookieStore.set(DEMO_ACCESS_COOKIE, demoAccess, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 });
  // P19 / D38: what the middleware needs, signed, so Admin navigation does not call the API on every click.
  const secret = adminProfileSecret();
  if (secret) {
    const profile = {
      admin: body.user.capabilities.includes(AppCapability.ADMIN_ACCESS),
      name: body.user.name,
      role: body.user.role,
    };
    cookieStore.set(ADMIN_PROFILE_COOKIE, await signAdminProfile(profile, token, secret), {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: ADMIN_PROFILE_MAX_AGE_SECONDS,
    });
  } else {
    cookieStore.delete(ADMIN_PROFILE_COOKIE);
  }

  return NextResponse.json({ user: body.user });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
  store.delete(ADMIN_PROFILE_COOKIE);
  return new NextResponse(null, { status: 204 });
}
