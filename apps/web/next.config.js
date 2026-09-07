/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ltl-shop/shared'],
  experimental: {
    authInterrupts: true,
  },
};

const { withSentryConfig } = require('@sentry/nextjs/config');

module.exports = withSentryConfig(nextConfig, {
  org: 'lightning-transport',
  project: 'javascript-nextjs',

  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    disable:
      process.env.VERCEL_ENV !== 'production' ||
      process.env.SENTRY_SKIP_SOURCE_MAP_UPLOAD === '1',
  },

  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
