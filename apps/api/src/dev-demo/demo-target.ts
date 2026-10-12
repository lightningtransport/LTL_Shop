/**
 * D39 (DP3): which database the demo scripts (`prisma:demo-local`, `reset-demo-work-orders --demo`) may wipe and
 * rebuild. On a laptop, a local database with "demo" in its name (D36). For the published demo, its own Supabase
 * project, named by ref in DEMO_SUPABASE_REF (a Supabase database is always called "postgres", and the pooler host
 * is shared by every project, so only the ref tells them apart). Production's project is refused whatever is set.
 */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/** The production Supabase project (docs/GO_LIVE_CHECKLIST_ES.md). */
export const PRODUCTION_SUPABASE_REF = 'mjlfynzqmxoezanvyniw';

/** Why the demo scripts must not touch this database, or null when they may. */
export function demoDatabaseRefusal(url: string, env: NodeJS.ProcessEnv = process.env): string | null {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return 'DEMO_DATABASE_URL is not a valid database URL.';
  }
  if (url.includes(PRODUCTION_SUPABASE_REF)) return 'Refusing: that is the production database.';
  const database = target.pathname.replace(/^\//, '');
  if (LOCAL_HOSTS.includes(target.hostname)) {
    return /demo/i.test(database) ? null : `Refusing ${target.hostname}/${database}: a local demo database needs "demo" in its name.`;
  }
  const ref = env.DEMO_SUPABASE_REF?.trim();
  // Supabase refs are 20 characters; a short value would match too much.
  if (ref && ref.length >= 15 && ref !== PRODUCTION_SUPABASE_REF && `${target.username}@${target.hostname}`.includes(ref)) return null;
  return `Refusing ${target.hostname}: only a local database whose name contains "demo", or the published demo's Supabase project (DEMO_SUPABASE_REF).`;
}
