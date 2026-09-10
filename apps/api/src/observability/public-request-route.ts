const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function publicRequestRoute(request: {
  originalUrl?: string;
  url?: string;
  route?: { path?: string };
}): string {
  const nestPath = request.route?.path;
  if (nestPath) {
    return nestPath.startsWith('/api') ? nestPath : `/api${nestPath.startsWith('/') ? nestPath : `/${nestPath}`}`;
  }
  const raw = (request.originalUrl ?? request.url ?? '').split('?')[0] || 'unknown';
  return raw.replace(UUID, ':id');
}
