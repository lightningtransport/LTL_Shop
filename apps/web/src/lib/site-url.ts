export function getSiteUrl(browserOrigin?: string) {
  if (browserOrigin && /^(http:\/\/localhost|http:\/\/127\.0\.0\.1)/.test(browserOrigin)) {
    return browserOrigin.replace(/\/$/, '');
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
  const base = configured || vercelUrl || browserOrigin || 'http://localhost:3000';
  return (base.startsWith('http') ? base : `https://${base}`).replace(/\/$/, '');
}

export function passwordResetRedirectUrl(browserOrigin?: string) {
  return `${getSiteUrl(browserOrigin)}/reset-password`;
}
