import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

/**
 * Mobile UI walk (skill `mobile-ui-check`). Off unless MOBILE_WALK=1: it is a review tool, not a regression test.
 * For every Admin screen on a phone it scrolls the page's own scroller (`main`), takes screenshots, opens the menu,
 * and measures what can be measured without opinions: elements cut at the right edge, tap targets under 44 px,
 * truncated text, and "1 jobs"-style plurals. Output: MOBILE_WALK_OUT (default test-results/mobile-walk).
 */
const OUT = process.env.MOBILE_WALK_OUT ?? 'test-results/mobile-walk';
const PAGES: Array<[string, string]> = [
  ['dashboard', '/admin'],
  ['yard', '/admin/yard-operations'],
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

test('mobile walk', async ({ page }, info) => {
  test.skip(process.env.MOBILE_WALK !== '1', 'review tool: MOBILE_WALK=1');
  test.setTimeout(600_000);
  const dir = `${OUT}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  await devLogin(page, 'manager@lightning.local');
  const report: Record<string, unknown> = {};
  for (const [name, path] of PAGES) {
    await page.goto(path);
    await page.waitForTimeout(1500);
    const heights = await page.evaluate(() => {
      const main = document.querySelector('main');
      return { scroll: main?.scrollHeight ?? 0, view: main?.clientHeight ?? 0, doc: document.documentElement.scrollHeight, inner: window.innerHeight };
    });
    const shots = Math.min(6, Math.max(1, Math.ceil(heights.scroll / Math.max(1, heights.view))));
    const found = { cut: new Set<string>(), small: new Set<string>(), truncated: new Set<string>(), plurals: new Set<string>() };
    for (let index = 0; index < shots; index += 1) {
      await page.evaluate(([i, view]) => { const main = document.querySelector('main'); if (main) main.scrollTop = i * (view - 80); }, [index, heights.view] as const);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${dir}/${name}-${index + 1}.png` });
      const pass = await page.evaluate(() => {
        const width = window.innerWidth;
        const label = (el: Element) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50)}"`;
        const inScroller = (el: Element) => { for (let node = el.parentElement; node && node.tagName !== 'MAIN'; node = node.parentElement) { const x = getComputedStyle(node).overflowX; if (x === 'auto' || x === 'scroll') return true; } return false; };
        const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight; };
        const all = [...document.querySelectorAll('main *')].filter(visible);
        // The first box that runs past the right edge (its parent still fits): a button with an icon counts too.
        const cut = all.filter((el) => el.getBoundingClientRect().right > width + 1 && !inScroller(el) && getComputedStyle(el).position !== 'fixed'
          && (el.parentElement?.getBoundingClientRect().right ?? 0) <= width + 1).map(label);
        const small = [...document.querySelectorAll('main button, main a, main select, main input:not([type=checkbox]):not([type=radio])')].filter(visible)
          .filter((el) => !el.classList.contains('tap-inline') && !el.closest('.tap-inline') && el.getBoundingClientRect().height < 43.5).map((el) => `${label(el)} h=${Math.round(el.getBoundingClientRect().height)}`);
        // `sr-only` labels are 1 px on purpose: not truncation.
        const truncated = all.filter((el) => { const s = getComputedStyle(el); return !el.closest('.sr-only') && el.getBoundingClientRect().width > 1 && el.scrollWidth > el.clientWidth + 1 && (s.textOverflow === 'ellipsis' || s.overflow === 'hidden') && el.children.length === 0 && (el.textContent ?? '').trim().length > 0; }).map(label);
        const text = document.querySelector('main')?.innerText ?? '';
        const plurals = [...text.matchAll(/(?<![\d.,])1 (jobs|parts|purchases|lines|trucks|Work Orders|hours|days|mechanics|people|findings|invoices|repairs|vendors|steps|checks)\b/gi)].map((match) => match[0]);
        return { cut, small, truncated, plurals };
      });
      pass.cut.forEach((value) => found.cut.add(value));
      pass.small.forEach((value) => found.small.add(value));
      pass.truncated.forEach((value) => found.truncated.add(value));
      pass.plurals.forEach((value) => found.plurals.add(value));
    }
    let menu = 'no menu button';
    const button = page.getByRole('button', { name: 'Open Shop Admin navigation' });
    if (await button.isVisible()) {
      await button.click();
      await page.waitForTimeout(900);
      menu = (await page.getByRole('dialog').isVisible()) ? 'opens' : 'DOES NOT OPEN';
      await page.screenshot({ path: `${dir}/${name}-menu.png` });
      await page.keyboard.press('Escape');
    }
    report[name] = { path, ...heights, menu, cut: [...found.cut], small: [...found.small], truncated: [...found.truncated], plurals: [...found.plurals] };
  }
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
  expect(Object.keys(report).length).toBe(PAGES.length);
});
