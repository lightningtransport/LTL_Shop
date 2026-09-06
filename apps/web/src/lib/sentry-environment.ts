export type SentryRuntime = 'client' | 'server';

function deploymentEnvironment(runtime: SentryRuntime) {
  return runtime === 'client' ? process.env.NEXT_PUBLIC_VERCEL_ENV : process.env.VERCEL_ENV;
}

export function getSentryDsn(runtime: SentryRuntime) {
  if (runtime === 'client') return process.env.NEXT_PUBLIC_SENTRY_DSN;
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export function isSentryEnabled(runtime: SentryRuntime) {
  return deploymentEnvironment(runtime) === 'production' && Boolean(getSentryDsn(runtime));
}

export function getSentryEnvironment(runtime: SentryRuntime) {
  return deploymentEnvironment(runtime) ?? 'development';
}
