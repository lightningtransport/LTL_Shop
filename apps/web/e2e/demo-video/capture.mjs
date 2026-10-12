// Demo intro video, step 1 of 2 (README.md in this folder): screenshots of the real app, in the order of a day
// at the shop, from the local demo data (docs/reference/DEMO.md). Each shot can name a focus box (the part of the
// screen the scene zooms into and highlights); its position is measured here, so layout changes do not break it.
// Output: e2e/demo-video/shots/*.png and shots/shots.json.
//
//   node e2e/demo-video/capture.mjs --base=http://localhost:3042
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: { base: { type: 'string', default: process.env.DEMO_VIDEO_BASE_URL ?? 'http://localhost:3042' } },
});
const BASE = args.base;
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

// 1600x900 at 2.4x is a 3840x2160 image: the slow zoom of each scene stays sharp in a 1080p video.
const DESKTOP = { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2.4 };
const PHONE = { ...devices['iPhone 13'], deviceScaleFactor: 3 };
delete PHONE.defaultBrowserType;

// The Next.js dev badge and the Demo panel are not part of the product.
const HIDE = 'nextjs-portal,[data-demo-panel],[data-demo-toggle]{display:none!important}';

const browser = await chromium.launch();
const shots = {};

async function signIn(email, device) {
  const context = await browser.newContext({ ...device, colorScheme: 'light' });
  await context.addCookies([{ name: 'ltl_shop_locale', value: 'en', url: BASE }]);
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  // Same hydration wait as e2e/support/dev-login.ts.
  await page.waitForFunction(() => {
    const input = document.querySelector('#login-email');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith('__reactProps$')));
  }, undefined, { timeout: 90_000 });
  await page.locator('#login-email').fill(email);
  await page.getByRole('button', { name: /Dev Login/i }).click();
  await page.waitForURL((url) => url.pathname !== '/' && !url.pathname.startsWith('/login'), { timeout: 90_000 });
  await page.waitForTimeout(1500);
  return page;
}

async function open(page, path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(1200);
}

/** The href of the first link whose text matches, read from a list page (ids change on every demo rebuild). */
async function hrefOf(page, listPath, text, hrefPart) {
  await open(page, listPath);
  const href = await page.evaluate(([t, part]) => [...document.querySelectorAll('a[href]')]
    .find((a) => a.innerText.trim() === t && a.getAttribute('href').includes(part))?.getAttribute('href'), [text, hrefPart]);
  if (!href) throw new Error(`No link "${text}" on ${listPath}`);
  return href;
}

/** Saves the viewport and the focus box (fractions of the image) of the element `focus` resolves to. */
async function shoot(page, name, focus) {
  let box = null;
  if (focus) {
    const handle = await focus(page);
    const rect = handle && await handle.boundingBox();
    const view = page.viewportSize();
    if (rect) box = { x: rect.x / view.width, y: rect.y / view.height, w: rect.width / view.width, h: rect.height / view.height };
    else console.warn(`  ${name}: focus not found`);
  }
  await page.screenshot({ path: `${OUT}${name}.png` });
  shots[name] = { file: `${name}.png`, focus: box };
  console.log(`  ${name}${box ? ' (focus)' : ''}`);
}

// The nearest ancestor of the text at least `minWidth` x `minHeight` px: a card or a panel, not the label.
const block = (text, minWidth = 300, minHeight = 60) => async (page) => {
  const label = page.getByText(text, { exact: false }).first();
  if (!(await label.count())) return null;
  return label.evaluateHandle((el, [w, h]) => {
    let e = el;
    while (e.parentElement && (e.getBoundingClientRect().width < w || e.getBoundingClientRect().height < h)) e = e.parentElement;
    return e;
  }, [minWidth, minHeight]);
};

console.log('Manager (MS)');
const manager = await signIn('ms@lightning.local', DESKTOP);
await open(manager, '/admin');
await shoot(manager, '01-dashboard', block('Blocked or paused', 1000));
await open(manager, '/admin/yard-operations');
await shoot(manager, '02-yard', block('Blocked · Waiting for Parts', 200, 100));
await open(manager, '/admin/work-orders/new');
await manager.getByPlaceholder(/Search by truck number/i).fill('60').catch(() => {});
await manager.waitForTimeout(1500);
await shoot(manager, '03-new-work-order', block('Choose the truck', 500, 150));
const blockedOrder = await hrefOf(manager, '/admin/work-orders', 'WO-061', '/admin/work-orders/');
await open(manager, blockedOrder);
await shoot(manager, '05-blocker', block('Next step · Blocker', 600, 80));
const readyTruck = await hrefOf(manager, '/admin/trucks', '607', '/admin/trucks/');
await open(manager, readyTruck.split('?')[0]);
await shoot(manager, '08-ready-to-go', block('Next step · Ready to Go', 1000, 80));
const truck = await hrefOf(manager, '/admin/trucks', '605', '/admin/trucks/');
await open(manager, `${truck.split('?')[0]}?tab=costs`);
await shoot(manager, '09-truck-costs', block('Movements', 600, 100));
await open(manager, '/admin/parts/internal-invoices');
await shoot(manager, '10-month-close', block('Month close', 800, 40));
await open(manager, '/admin/mechanics');
await shoot(manager, '11a-people', null);
await open(manager, '/admin/setup/workflow/hours');
await shoot(manager, '11b-shop-hours', block('Day close', 500, 100));

console.log('Mechanic (MG1)');
const mechanic = await signIn('mg1@lightning.local', PHONE);
await open(mechanic, '/mechanic/standard');
await shoot(mechanic, '04-mechanic', null);

console.log('PM (MPM)');
const pm = await signIn('mpm@lightning.local', PHONE);
await open(pm, '/mechanic/pm');
await shoot(pm, '06-pm', null);

console.log('Quality Check (QC1)');
const qc = await signIn('qc1@lightning.local', PHONE);
await open(qc, '/qc');
await shoot(qc, '07-qc', null);

writeFileSync(`${OUT}shots.json`, `${JSON.stringify(shots, null, 2)}\n`);
await browser.close();
console.log(`Saved ${Object.keys(shots).length} shots to ${OUT}`);
