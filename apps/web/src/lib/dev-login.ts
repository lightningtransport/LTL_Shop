/**
 * Dev Login (local bypass) is shown outside production builds, and in a production build made only for the
 * e2e suite (NEXT_PUBLIC_E2E_DEV_LOGIN=1, LTR-163). It only works against an API with AUTH_DEV_BYPASS=true,
 * which production never sets, so the flag cannot open a login on the deployed app.
 */
export function devLoginEnabled(nodeEnv: string | undefined, e2eDevLogin: string | undefined): boolean {
  return nodeEnv !== 'production' || e2eDevLogin === '1';
}

// Both values are inlined at build time by Next.js.
export const DEV_LOGIN_ENABLED = devLoginEnabled(process.env.NODE_ENV, process.env.NEXT_PUBLIC_E2E_DEV_LOGIN);

/** The Admin session cookie is Secure in production, except in the e2e build served over http://127.0.0.1. */
export function adminSessionCookieSecure(nodeEnv: string | undefined, e2eDevLogin: string | undefined): boolean {
  return nodeEnv === 'production' && e2eDevLogin !== '1';
}

/**
 * D36: the local demo panel (switch between demo accounts, guided stories) mounts only where Dev Login
 * does: this is false in the production build, and switching needs an API with AUTH_DEV_BYPASS=true anyway.
 */
export const DEMO_MODE_AVAILABLE = DEV_LOGIN_ENABLED;
