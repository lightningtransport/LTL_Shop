export function getSentryDsn() {
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export function isSentryEnabled() {
  return process.env.VERCEL_ENV === 'production' && Boolean(getSentryDsn());
}

export function getSentryEnvironment() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
}
