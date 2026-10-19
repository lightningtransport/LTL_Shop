// LTR-172: screenshots of states the crawl in audit.mjs does not reach: menus, dialogs, sheets,
// toasts, loading with a slow API, and long names injected into API responses. iPhone 13 on WebKit.
// Output: e2e/ui-audit/output/states/. Resets the fixture API first, since some steps change its data.
//
//   npm run ui-audit:states -- --locale=en
import { devices, webkit } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: process.env.UI_AUDIT_BASE_URL ?? 'http://127.0.0.1:3030' },
    api: { type: 'string', default: process.env.UI_AUDIT_API_URL ?? 'http://127.0.0.1:3101' },
    locale: { type: 'string', default: 'es' },
    scheme: { type: 'string', default: 'light' },
  },
});

const BASE = args.base;
const OUT = fileURLToPath(new URL('./output/states/', import.meta.url));
mkdirSync(OUT, { recursive: true });
// Steps add a note and complete WO-0102; start from the fixture's initial data every run.
const reset = await fetch(`${args.api}/__test/reset`, { method: 'POST' }).catch(() => null);
if (!reset?.ok) throw new Error(`Could not reset the fixture API at ${args.api}. Is e2e/fixtures/admin-api.mjs running?`);

const browser = await webkit.launch();
const log = [];

const LONG_NAMES = [
  ['Inspect brake chamber', 'Inspect and replace front left brake chamber diaphragm and push rod'],
  ['Alejandro 1', 'Alejandro Guadalupe Hernández Rodríguez'],
  ['"Brakes"', '"Brakes, Air System & ABS Diagnostics"'],
  ['"T-106"', '"T-106-LTL-2024-NORTH"'],
  ['"T-102"', '"T-102-LTL-2024-NORTH"'],
];

async function session(role, { longNames = false, slowApi = false } = {}) {
  const context = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, colorScheme: args.scheme });
  await context.addCookies([{ name: 'ltl_shop_locale', value: args.locale, url: BASE }]);
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForFunction(() => {
    const input = document.querySelector('#login-email');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith('__reactProps$')));
  }, undefined, { timeout: 90_000 });
  await page.locator('#login-email').fill(`${role}@lightning.local`);
  await page.getByRole('button', { name: /Dev Login|Acceso de desarrollo/i }).click();
  await page.waitForURL((url) => url.pathname !== '/' && !url.pathname.startsWith('/login'), { timeout: 90_000 });
  // The post-login redirect can replace the location more than once; wait until it settles.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const landed = page.url();
    await page.waitForTimeout(750);
    if (page.url() === landed) break;
  }
  if (longNames) {
    await page.route(`${args.api}/**`, async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      for (const [from, to] of LONG_NAMES) body = body.replaceAll(from, to);
      await route.fulfill({ response, body });
    });
  }
  if (slowApi) {
    await page.route(`${args.api}/**`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      await route.continue();
    });
  }
  return { context, page };
}

// A late client-side navigation can interrupt a goto or move the page after it loads. Retry until it stays.
async function visit(page, path) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(800);
    if (new URL(page.url()).pathname === path) return;
  }
  throw new Error(`the app kept navigating to ${new URL(page.url()).pathname} instead of ${path}`);
}

async function shot(page, name) {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}${name}.png` });
  log.push(`ok   ${name}`);
}

// One failing step (a label changed, a state is not reachable) is logged and the rest still run.
async function step(name, fn) {
  try {
    await fn();
  } catch (error) {
    log.push(`FAIL ${name}: ${error.message.split('\n')[0]}`);
  }
}

// Mechanic
{
  const { context, page } = await session('mechanic');
  await step('mechanic-user-menu', async () => {
    await page.getByRole('button', { name: /Alejandro/ }).first().click();
    await shot(page, 'mechanic-user-menu');
    await page.keyboard.press('Escape');
  });
  await step('mechanic-job-dialog', async () => {
    await page.getByRole('link', { name: /Ver trabajo|View work/i }).first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.getByText(/Inspect brake chamber/).first().click();
    await shot(page, 'mechanic-job-dialog');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
  await step('mechanic-truck-info-open', async () => {
    const toggle = page.getByText(/Información de la unidad|Truck information/i).first();
    await toggle.click();
    await shot(page, 'mechanic-truck-info-open');
    await toggle.click();
  });
  await step('mechanic-blocker-dialog', async () => {
    await page.getByRole('button', { name: /Reportar bloqueo|Report blocker/i }).click();
    await shot(page, 'mechanic-blocker-dialog');
    await page.keyboard.press('Escape');
  });
  await step('mechanic-note-added', async () => {
    await page.getByRole('textbox').last().fill('UI audit note');
    await page.getByRole('button', { name: /Agregar nota|Add note/i }).click();
    await page.waitForTimeout(400);
    await shot(page, 'mechanic-note-added');
  });
  await context.close();
}
{
  const { context, page } = await session('mechanic', { longNames: true });
  await step('mechanic-long-names-my-work', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await shot(page, 'mechanic-long-names-my-work');
  });
  await step('mechanic-long-names-work-order', async () => {
    await page.getByRole('link', { name: /Ver trabajo|View work/i }).first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await shot(page, 'mechanic-long-names-work-order');
  });
  await context.close();
}
{
  const { context, page } = await session('mechanic', { slowApi: true });
  await step('mechanic-loading', async () => {
    page.reload().catch(() => {});
    await page.waitForTimeout(2500);
    await shot(page, 'mechanic-loading');
  });
  await context.close();
}

// Manager. "Pause Work Order" pauses at once (no dialog), so the Pause controls are captured without pressing
// it. Confirm completion runs last on WO-0102 because it closes the Work Order.
{
  const { context, page } = await session('manager');
  await step('manager-drawer', async () => {
    await page.getByRole('button', { name: /menú|menu|navegación|navigation/i }).first().click();
    await shot(page, 'manager-drawer');
    await page.keyboard.press('Escape');
  });
  await step('manager-filters-sheet', async () => {
    await visit(page, '/admin/work-orders');
    await page.getByRole('button', { name: /Filtros|Filters/i }).first().click();
    await shot(page, 'manager-filters-sheet');
    await page.keyboard.press('Escape');
  });
  await step('manager-more-actions', async () => {
    await visit(page, '/admin/work-orders/00000000-0000-4000-8000-000000000102');
    // Stage 5: the "…" is a dropdown menu (no "More actions" modal any more).
    await page.getByTestId('admin-wo-more-actions').click();
    await page.getByTestId('admin-wo-more-menu').waitFor();
    await shot(page, 'manager-more-actions');
    await page.keyboard.press('Escape');
  });
  await step('manager-pause-controls', async () => {
    await page.getByRole('button', { name: /^Pausar Work Order$|^Pause Work Order$/i }).first().scrollIntoViewIfNeeded();
    await shot(page, 'manager-pause-controls');
  });
  await step('manager-new-work-order-search', async () => {
    await visit(page, '/admin/work-orders/new');
    await page.getByRole('combobox').or(page.getByPlaceholder(/truck/i)).first().fill('T-1');
    await page.waitForTimeout(1200);
    await shot(page, 'manager-new-work-order-search');
  });
  await step('manager-add-work', async () => {
    await visit(page, '/admin/yard-operations');
    await page.getByRole('link', { name: /Y-102/ }).first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /Agregar trabajo|Add work/i }).first().click();
    await shot(page, 'manager-add-work');
  });
  await step('manager-confirm-completion', async () => {
    await visit(page, '/admin/work-orders/00000000-0000-4000-8000-000000000102');
    await page.getByRole('button', { name: /Confirmar finalización|Confirm completion/i }).first().click();
    await page.waitForTimeout(600);
    await shot(page, 'manager-confirm-completion');
  });
  await context.close();
}

await browser.close();
console.log(log.join('\n'));
console.log(`\nScreenshots in ${OUT}`);
