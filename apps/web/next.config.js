/** @type {import('next').NextConfig} */
const nextConfig = {
  // LTR-163: the e2e production build writes to its own folder so it never clobbers a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@ltl-shop/shared'],
  experimental: {
    authInterrupts: true,
    // PF13: import only the Radix primitives each file uses.
    optimizePackageImports: ['radix-ui'],
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
