import { mkdirSync, writeFileSync } from 'node:fs';
import { devices, type Page } from '@playwright/test';
import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

/**
 * Mobile UI walk (skill `mobile-ui-check`). Off unless MOBILE_WALK=1: it is a review tool, not a regression test.
 * For every Admin screen on a phone it scrolls the page's own scroller (`main`), takes screenshots, opens the menu,
 * and measures what can be measured without opinions: elements cut at the right edge, tap targets under 44 px,
 * truncated text, and "1 jobs"-style plurals. Output: MOBILE_WALK_OUT (default test-results/mobile-walk).
 *
 * MOBILE_WALK=field walks the mechanic, PM and Safety screens instead. They scroll the window, not `main`, and they
 * need real data: run it against a production build whose API reads a seeded `ltl_shop_test` (MOBILE_WALK_API).
 */
const OUT = process.env.MOBILE_WALK_OUT ?? 'test-results/mobile-walk';
const PAGES: Array<[string, string]> = [
  ['dashboard', '/admin'],
  ['yard', '/admin/yard-operations'],
  ['yard-dispatch', '/admin/yard-operations?tab=dispatch'],
  ['work-orders', '/admin/work-orders'],
  ['wo-detail', '/admin/work-orders/00000000-0000-4000-8000-000000000106'],
  ['trucks', '/admin/trucks'],
  ['truck-detail', '/admin/trucks/00000000-0000-4000-8000-000000001001'],
  ['purchases', '/admin/parts/purchases'],
  ['purchase-detail', '/admin/parts/purchases/00000000-0000-4000-8000-00000000b001'],
  ['parts', '/admin/parts/catalog'],
  ['count', '/admin/parts/count'],
  ['outside', '/admin/parts/outside-repairs'],
  ['invoices', '/admin/parts/internal-invoices'],
  ['vendors', '/admin/parts/vendors'],
  ['people', '/admin/mechanics'],
  ['jobs', '/admin/catalog'],
  ['workflow', '/admin/setup/workflow'],
  ['inspection', '/admin/setup/inspection'],
  ['samsara', '/admin/setup/samsara'],
  ['rates', '/admin/parts/labor-rate'],
];

type Found = { cut: string[]; small: string[]; truncated: string[]; plurals: string[] };

/** Screenshots one screen top to bottom and measures it. The Admin panel scrolls `main`; the field apps scroll the window. */
async function walkScreen(page: Page, dir: string, name: string) {
  await page.waitForTimeout(1500);
  const heights = await page.evaluate(() => {
    const main = document.querySelector('main');
    const inner = Boolean(main && main.scrollHeight > main.clientHeight + 1 && getComputedStyle(main).overflowY !== 'visible');
    return {
      scroller: inner ? 'main' : 'window',
      scroll: inner ? main!.scrollHeight : document.documentElement.scrollHeight,
      view: inner ? main!.clientHeight : window.innerHeight,
      doc: document.documentElement.scrollHeight,
      inner: window.innerHeight,
    };
  });
  const shots = Math.min(8, Math.max(1, Math.ceil(heights.scroll / Math.max(1, heights.view))));
  const found = { cut: new Set<string>(), small: new Set<string>(), truncated: new Set<string>(), plurals: new Set<string>() };
  for (let index = 0; index < shots; index += 1) {
    await page.evaluate(([i, view, scroller]) => {
      const top = Number(i) * (Number(view) - 80);
      const main = document.querySelector('main');
      if (scroller === 'main' && main) main.scrollTop = top;
      else window.scrollTo(0, top);
    }, [index, heights.view, heights.scroller] as const);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${dir}/${name}-${index + 1}.png` });
    const pass: Found = await page.evaluate(() => {
      const width = window.innerWidth;
      const label = (el: Element) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50) || el.getAttribute('aria-label') || ''}"`;
      const inScroller = (el: Element) => { for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) { const x = getComputedStyle(node).overflowX; if (x === 'auto' || x === 'scroll') return true; } return false; };
      const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight; };
      const all = [...document.querySelectorAll('body *')].filter((el) => !el.closest('[data-nextjs-toast], nextjs-portal, script, style')).filter(visible);
      // The first box that runs past the right edge (its parent still fits): a button with an icon counts too.
      const cut = all.filter((el) => el.getBoundingClientRect().right > width + 1 && !inScroller(el) && !el.closest('.sr-only')
        && (el.parentElement?.getBoundingClientRect().right ?? 0) <= width + 1).map(label);
      const small = [...document.querySelectorAll('button, a, select, input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, [role=tab]')].filter(visible)
        .filter((el) => !el.closest('.sr-only') && !el.classList.contains('tap-inline') && !el.closest('.tap-inline') && el.getBoundingClientRect().height < 43.5)
        .map((el) => `${label(el)} h=${Math.round(el.getBoundingClientRect().height)}`);
      // `sr-only` labels are 1 px on purpose: not truncation.
      const truncated = all.filter((el) => { const s = getComputedStyle(el); return !el.closest('.sr-only') && el.getBoundingClientRect().width > 1 && el.scrollWidth > el.clientWidth + 1 && (s.textOverflow === 'ellipsis' || s.overflow === 'hidden') && el.children.length === 0 && (el.textContent ?? '').trim().length > 0; }).map(label);
      const text = document.body.innerText;
      const plurals = [...text.matchAll(/(?<![\d.,])1 (jobs|parts|purchases|lines|trucks|Work Orders|hours|days|mechanics|people|findings|invoices|repairs|vendors|steps|checks|camiones|trabajos|partes|horas|días)\b/gi)].map((match) => match[0]);
      return { cut, small, truncated, plurals };
    });
    pass.cut.forEach((value) => found.cut.add(value));
    pass.small.forEach((value) => found.small.add(value));
    pass.truncated.forEach((value) => found.truncated.add(value));
    pass.plurals.forEach((value) => found.plurals.add(value));
  }
  return { ...heights, cut: [...found.cut], small: [...found.small], truncated: [...found.truncated], plurals: [...found.plurals] };
}

test('mobile walk', async ({ page }, info) => {
  test.skip(process.env.MOBILE_WALK !== '1', 'review tool: MOBILE_WALK=1');
  test.setTimeout(600_000);
  const dir = `${OUT}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  await devLogin(page, 'manager@lightning.local');
  const report: Record<string, unknown> = {};
  for (const [name, path] of PAGES) {
    await page.goto(path);
    const measured = await walkScreen(page, dir, name);
    let menu = 'no menu button';
    const button = page.getByRole('button', { name: 'Open Shop Admin navigation' });
    if (await button.isVisible()) {
      await button.click();
      await page.waitForTimeout(900);
      menu = (await page.getByRole('dialog').isVisible()) ? 'opens' : 'DOES NOT OPEN';
      await page.screenshot({ path: `${dir}/${name}-menu.png` });
      await page.keyboard.press('Escape');
    }
    report[name] = { path, ...measured, menu };
  }
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
  expect(Object.keys(report).length).toBe(PAGES.length);
});

/** The field accounts of `ltl_shop_test` (apps/api/test-real/harness.ts). `{wo}` and `{truck}` come from the user's clock. */
const FIELD: Array<{ email: string; prefix: string; pages: Array<[string, string, string?]> }> = [
  { email: 'alejandro-2@lightning.local', prefix: 'general', pages: [
    ['home', '/mechanic/standard'], ['trucks', '/mechanic/standard/trucks'], ['completed', '/mechanic/standard/completed'],
    ['new', '/mechanic/standard/new'], ['wo', '/work-orders/{wo}'], ['wo-blocker', '/work-orders/{wo}', 'Report blocker'], ['truck-history', '/trucks/{truck}/history'],
  ] },
  { email: 'mechanic@lightning.local', prefix: 'alignment', pages: [['home', '/mechanic/standard'], ['wo', '/work-orders/{wo}']] },
  { email: 'daniel@lightning.local', prefix: 'pm', pages: [
    ['home', '/mechanic/pm'], ['trucks', '/mechanic/pm/trucks'], ['completed', '/mechanic/pm/completed'],
    ['new', '/mechanic/pm/new'], ['wo', '/work-orders/{wo}'], ['wo-blocker', '/work-orders/{wo}', 'Report blocker'],
  ] },
  { email: 'safety-1@lightning.local', prefix: 'safety', pages: [['review', '/qc'], ['review-open', '/qc', 'Continue review'], ['returned', '/qc?tab=returned'], ['done', '/qc?tab=done']] },
];

test('mobile walk (field apps)', async ({ page, browser }, info) => {
  test.skip(process.env.MOBILE_WALK !== 'field', 'review tool: MOBILE_WALK=field');
  test.setTimeout(900_000);
  const api = process.env.MOBILE_WALK_API ?? 'http://127.0.0.1:3211';
  const dir = `${OUT}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  const report: Record<string, unknown> = {};
  await page.goto('/login');
  report['login'] = { path: '/login', ...(await walkScreen(page, dir, 'login')) };
  for (const account of FIELD) {
    const context = await browser.newContext({ ...devices['iPhone 13'], baseURL: info.project.use.baseURL });
    const tab = await context.newPage();
    await devLogin(tab, account.email);
    const list = await (await fetch(`${api}/api/work-orders`, { headers: { Authorization: `Bearer dev:${account.email}` } })).json();
    const wo = list.myClock?.workOrderId ?? list.created?.[0]?.id ?? '';
    const truck = (list.created ?? []).find((item: { id: string }) => item.id === wo)?.truckId ?? list.created?.[0]?.truckId ?? '';
    for (const [name, path, open] of account.pages) {
      if ((path.includes('{wo}') && !wo) || (path.includes('{truck}') && !truck)) continue;
      const url = path.replace('{wo}', wo).replace('{truck}', truck);
      await tab.goto(url);
      // A third value opens that button first (a dialog or the review sheet) and walks what it shows.
      if (open) { await tab.getByRole('button', { name: open }).first().click(); await tab.waitForTimeout(900); }
      report[`${account.prefix}-${name}`] = { path: url, ...(await walkScreen(tab, dir, `${account.prefix}-${name}`)) };
    }
    await context.close();
  }
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
  expect(Object.keys(report).length).toBeGreaterThan(1);
});
