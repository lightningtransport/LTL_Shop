import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

/**
 * LTR-259: tablet UI walk (skill `mobile-ui-check`, tablet section). Off unless TABLET_WALK=1, which also swaps the
 * Playwright projects for iPad Pro 11" portrait (834×1194) and landscape (1194×834). For every Admin screen it
 * screenshots the page and measures four things:
 * - overflow: `main` scrolls sideways.
 * - overlap: two visible controls (input, select, button, link) cover each other.
 * - gutter: a capped container or the content leaves more than 120 px empty on the right of the content column.
 * - copy: visible text longer than 120 characters, or words that belong to the team, not the shop (D34, LTR-, Vercel…).
 * Output: TABLET_WALK_OUT (default test-results/tablet-walk)/<project>/report.json.
 */
const OUT = process.env.TABLET_WALK_OUT ?? 'test-results/tablet-walk';
const PAGES: Array<[string, string]> = [
  ['dashboard', '/admin'],
  ['yard', '/admin/yard-operations'],
  ['yard-dispatch', '/admin/yard-operations?tab=dispatch'],
  ['work-orders', '/admin/work-orders'],
  ['wo-new', '/admin/work-orders/new'],
  ['wo-detail', '/admin/work-orders/00000000-0000-4000-8000-000000000106'],
  ['trucks', '/admin/trucks'],
  ['truck-detail', '/admin/trucks/00000000-0000-4000-8000-000000001001'],
  ['history', '/admin/history'],
  ['purchases', '/admin/parts/purchases'],
  ['purchase-detail', '/admin/parts/purchases/00000000-0000-4000-8000-00000000b001'],
  ['parts', '/admin/parts/catalog'],
  ['stock', '/admin/parts/stock'],
  ['count', '/admin/parts/count'],
  ['outside', '/admin/parts/outside-repairs'],
  ['invoices', '/admin/parts/internal-invoices'],
  ['vendors', '/admin/parts/vendors'],
  ['rates', '/admin/parts/labor-rate'],
  ['people', '/admin/mechanics'],
  ['jobs', '/admin/catalog'],
  ['jobs-review', '/admin/catalog/review'],
  ['workflow', '/admin/setup/workflow'],
  ['hours', '/admin/setup/workflow/hours'],
  ['inspection', '/admin/setup/inspection'],
  ['samsara', '/admin/setup/samsara'],
];

type Found = { overflow: string[]; overlap: string[]; gutter: string[]; copy: string[] };

async function measure(page: Page): Promise<Found> {
  return page.evaluate(() => {
    const label = (el: Element) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''}"`;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < window.innerHeight && s.visibility !== 'hidden' && s.opacity !== '0' && !el.closest('.sr-only, [aria-hidden=true]');
    };
    const main = document.querySelector('main');
    const overflow: string[] = [];
    if (main && main.scrollWidth > main.clientWidth + 1) overflow.push(`main scrollWidth ${main.scrollWidth} > ${main.clientWidth}`);

    // Overlap: controls whose boxes intersect, neither inside the other, and not stacked in a dialog over the page.
    const controls = [...document.querySelectorAll('main input:not([type=hidden]), main select, main textarea, main button, main a[href], main [role=tab], main [role=combobox]')]
      .filter(visible).filter((el) => !(el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') && getComputedStyle(el).opacity === '0'));
    const overlap: string[] = [];
    for (let i = 0; i < controls.length; i += 1) {
      for (let j = i + 1; j < controls.length; j += 1) {
        const a = controls[i]; const b = controls[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
        const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (x > 3 && y > 3) overlap.push(`${label(a)} × ${label(b)} (${Math.round(x)}×${Math.round(y)})`);
      }
    }

    // Gutter: the content column is the first child of `main`. Report capped boxes and empty space on its right.
    const gutter: string[] = [];
    const column = main?.firstElementChild as HTMLElement | null;
    if (column) {
      const style = getComputedStyle(column);
      const right = column.getBoundingClientRect().right - parseFloat(style.paddingRight);
      const left = column.getBoundingClientRect().left + parseFloat(style.paddingLeft);
      const width = right - left;
      const boxes = [...column.querySelectorAll('*')].filter(visible).filter((el) => !el.closest('[role=dialog]'));
      const used = Math.max(...boxes.map((el) => el.getBoundingClientRect().right), left);
      if (right - used > 120) gutter.push(`content ends ${Math.round(right - used)}px before the column edge`);
      for (const el of boxes) {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (s.maxWidth !== 'none' && !s.maxWidth.endsWith('%') && r.height > 160 && r.width < width - 120 && r.width > 280
          && (el.parentElement?.getBoundingClientRect().width ?? 0) > width - 40) {
          gutter.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').filter((c) => c.includes('max-w')).join('.')} capped at ${Math.round(r.width)} of ${Math.round(width)}`);
        }
      }
    }

    // Copy: long visible paragraphs and team-only words.
    const copy: string[] = [];
    const banned = /\b(D\d{2}|LTR-\d+|Vercel|GitHub|npm|API token|SAMSARA_API_TOKEN|Activity Log|database|endpoint|prisma)\b/;
    for (const el of document.querySelectorAll('main p, main li, main dd, main small, main [role=note], main label, main span')) {
      if (!visible(el) || el.children.length > 2) continue;
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
      if (text.length > 120) copy.push(`long (${text.length}): ${text.slice(0, 90)}…`);
      else if (banned.test(text)) copy.push(`word "${text.match(banned)?.[0]}": ${text.slice(0, 90)}`);
    }
    return { overflow, overlap: [...new Set(overlap)], gutter: [...new Set(gutter)], copy: [...new Set(copy)] };
  });
}

test('tablet walk', async ({ page }, info) => {
  test.skip(process.env.TABLET_WALK !== '1', 'review tool: TABLET_WALK=1');
  test.setTimeout(900_000);
  const dir = `${OUT}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  await devLogin(page, 'manager@lightning.local');
  const only = process.env.TABLET_WALK_ONLY?.split(',');
  const report: Record<string, unknown> = {};
  for (const [name, path] of PAGES) {
    if (only && !only.includes(name)) continue;
    await page.goto(path);
    await page.waitForTimeout(1500);
    const found: Found = { overflow: [], overlap: [], gutter: [], copy: [] };
    const view = await page.evaluate(() => { const m = document.querySelector('main'); return { scroll: m?.scrollHeight ?? 0, view: m?.clientHeight ?? 1 }; });
    const shots = Math.min(5, Math.max(1, Math.ceil(view.scroll / Math.max(1, view.view))));
    for (let index = 0; index < shots; index += 1) {
      await page.evaluate(([i, h]) => { const m = document.querySelector('main'); if (m) m.scrollTop = Number(i) * (Number(h) - 80); }, [index, view.view] as const);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${dir}/${name}-${index + 1}.png` });
      const pass = await measure(page);
      (Object.keys(found) as Array<keyof Found>).forEach((key) => { found[key] = [...new Set([...found[key], ...pass[key]])]; });
    }
    // The Filters sheet (below the inline breakpoint) is where most controls live on a tablet: capture it too.
    await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 0; });
    const filters = page.getByRole('button', { name: /^(Filters|Filtros)/ }).first();
    if (await filters.isVisible().catch(() => false)) {
      await filters.click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${dir}/${name}-filters.png` });
      await page.keyboard.press('Escape');
    }
    const errors = await page.getByText('Something went wrong').count();
    report[name] = { path, ...found, error: errors > 0 };
  }
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
  expect(Object.keys(report).length).toBeGreaterThan(0);
});
