/** The flow tests wipe Work Orders, so they get their own database, never the developer's `ltl_shop`. */
export const REAL_DATABASE_URL =
  process.env.REAL_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ltl_shop_test';

/** LTR-186: the cron secret the flow-test API starts with (local only, never a real secret). */
export const REAL_CRON_SECRET = 'flow-test-cron-secret';

export function assertLocalDatabase(url: string) {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)) {
    throw new Error(`Refusing to run flow tests against ${parsed.hostname}: they delete every Work Order. Use a local database.`);
  }
  const database = parsed.pathname.replace(/^\//, '');
  if (!/test/i.test(database)) {
    throw new Error(`Refusing to run flow tests on database "${database}": its name must contain "test".`);
  }
}
