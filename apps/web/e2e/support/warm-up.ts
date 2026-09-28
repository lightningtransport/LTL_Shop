import type { FullConfig } from '@playwright/test';

/**
 * LTR-162: `next dev` compiles each route the first time it is requested. Without a warm-up the first
 * test to reach a route waits for that compile, hydrates late, and its clicks land on a page React does
 * not own yet. Request every route the specs visit once, before any test runs.
 */
const ROUTES = [
  '/login',
  '/',
  '/admin',
  '/admin/catalog',
  '/admin/catalog/categories/00000000-0000-4000-8000-000000000301',
  '/admin/history',
  '/admin/mechanics',
  '/admin/mechanics/00000000-0000-4000-8000-000000000001',
  '/admin/trucks',
  '/admin/trucks/00000000-0000-4000-8000-000000001001',
  '/admin/work-orders',
  '/admin/work-orders/new',
  '/admin/work-orders/00000000-0000-4000-8000-000000000101',
  '/admin/yard-operations',
  '/mechanic/standard',
  '/mechanic/standard/new',
  '/mechanic/pm',
  '/mechanic/pm/new',
  '/mechanic/pm/trucks',
  '/work-orders/new',
  '/work-orders/00000000-0000-4000-8000-000000000101',
  '/reset-password',
];

export default async function warmUp(config: FullConfig) {
  if (!process.env.ADMIN_E2E_FIXTURE) return;
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://127.0.0.1:3010';
  for (const route of ROUTES) {
    try {
      await fetch(new URL(route, baseURL), { redirect: 'manual', signal: AbortSignal.timeout(120_000) });
    } catch {
      // A route that fails here fails loudly in its own spec.
    }
  }
}
