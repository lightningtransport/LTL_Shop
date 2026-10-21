import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

/**
 * LTR-259: tablet UI walk (skill `mobile-ui-check`, tablet section). Off unless TABLET_WALK=1, which also swaps the
 * Playwright projects for iPad Pro 11" portrait (834×1194), landscape (1194×834) and Safari's default desktop mode
 * (LTR-271: the page is drawn about 980 px wide, so `md` applies but `lg` does not). For every Admin screen it
 * screenshots the page and measures four things (LTR-264: also the New purchase / New outside repair dialogs and the
 * mechanic and PM screens, which use the iPad width since D54):
 * - overflow: `main` scrolls sideways.
 * - overlap: two visible controls (input, select, button, link) cover each other.
 * - gutter: a capped container or the content leaves more than 120 px empty on the right of the content column.
 * - lonely (LTR-271): a card alone on a row of a two-column grid, with the other half of the row empty. On the wide
 *   mechanic screens, gutter also reports more than 48 px empty between the page and the window edge.
 * - actions (LTR-274): a card's action bar (`data-card-action`) whose buttons do not fill the card, or a button there
 *   with no fill and no border (it reads as text).
 * - copy: visible text longer than 120 characters, or words that belong to the team, not the shop (D34, LTR-, Vercel…).
 * TABLET_WALK_DARK=1 walks in dark mode (LTR-274: the owner's iPad is dark; light alone hid a ghost button).
 * Output: TABLET_WALK_OUT (default test-results/tablet-walk)/<project>/report.json.
 */
const OUT = process.env.TABLET_WALK_OUT ?? 'test-results/tablet-walk';
type Walk = [name: string, path: string, options?: { user?: string; open?: RegExp }];
const MANAGER = 'manager@lightning.local';
const PAGES: Walk[] = [
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
  ['purchase-new', '/admin/parts/purchases', { open: /^(New purchase|Nueva compra)$/ }],
  ['outside-new', '/admin/parts/outside-repairs', { open: /^(New outside repair|Nueva reparación externa)$/ }],
  ['mechanic-home', '/mechanic/standard', { user: 'mechanic@lightning.local' }],
  ['mechanic-trucks', '/mechanic/standard/trucks', { user: 'mechanic@lightning.local' }],
  ['mechanic-completed', '/mechanic/standard/completed', { user: 'mechanic@lightning.local' }],
  ['mechanic-new', '/mechanic/standard/new', { user: 'mechanic@lightning.local' }],
  ['mechanic-wo', '/work-orders/00000000-0000-4000-8000-000000000106', { user: 'mechanic@lightning.local' }],
  ['mechanic-truck', '/trucks/00000000-0000-4000-8000-000000001001/history', { user: 'mechanic@lightning.local' }],
  ['pm-home', '/mechanic/pm', { user: 'mpm@lightning.local' }],
  ['pm-trucks', '/mechanic/pm/trucks', { user: 'mpm@lightning.local' }],
  ['pm-completed', '/mechanic/pm/completed', { user: 'mpm@lightning.local' }],
  ['pm-new', '/mechanic/pm/new', { user: 'mpm@lightning.local' }],
  // LTR-272: Safety's Quality Check uses the iPad width too.
  ['qc-review', '/qc', { user: 'qc1@lightning.local' }],
  ['qc-returned', '/qc?tab=returned', { user: 'qc1@lightning.local' }],
  ['qc-done', '/qc?tab=done', { user: 'qc1@lightning.local' }],
  ['qc-review-open', '/qc', { user: 'qc1@lightning.local', open: /^(Continue review|Continuar revisión)$/ }],
];

type Found = { overflow: string[]; overlap: string[]; gutter: string[]; lonely: string[]; actions: string[]; copy: string[] };

async function measure(page: Page, scope: string, wide: boolean): Promise<Found> {
  return page.evaluate(([root, wideShell]) => {
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
    const controls = [...document.querySelectorAll(['input:not([type=hidden])', 'select', 'textarea', 'button', 'a[href]', '[role=tab]', '[role=combobox]'].map((tag) => `${root} ${tag}`).join(', '))]
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
    // A phone-width shell on a tablet: `main` itself much narrower than the window (the Admin sidebar is 240 px).
    // LTR-271: the mechanic screens have no sidebar, so anything past a normal margin is an empty band.
    if (main && window.innerWidth - main.getBoundingClientRect().width > (wideShell ? 48 : 260)) gutter.push(`main is ${Math.round(main.getBoundingClientRect().width)} of ${window.innerWidth} px wide`);
    const column = main?.firstElementChild as HTMLElement | null;
    // Behind an open dialog the page is dimmed and hidden from the tree: its column says nothing about the layout.
    if (column && !root.includes('dialog')) {
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

    // Lonely (LTR-271): in a grid of two or more columns, a card (taller than 120 px) that ends its row alone.
    const lonely: string[] = [];
    for (const grid of document.querySelectorAll(`${root} *`)) {
      const s = getComputedStyle(grid);
      if (s.display !== 'grid' || !visible(grid)) continue;
      const columns = s.gridTemplateColumns.split(' ').filter(Boolean).length;
      if (columns < 2) continue;
      const cells = [...grid.children].filter(visible);
      const last = cells.at(-1);
      if (!last || last.getBoundingClientRect().height < 120) continue;
      const row = cells.filter((cell) => Math.abs(cell.getBoundingClientRect().top - last.getBoundingClientRect().top) < 2);
      const used = row.reduce((sum, cell) => sum + cell.getBoundingClientRect().width, 0);
      if (used < grid.getBoundingClientRect().width * 0.75) lonely.push(`${label(last)} alone on its row (${Math.round(used)} of ${Math.round(grid.getBoundingClientRect().width)} px)`);
    }

    // Actions (LTR-274): a card's action (`data-card-action`) fills the card's width and looks like a button — a fill or
    // a border — in light and dark. Before, on an iPad the button sat 224 px wide at the right of an empty band, and
    // the PM "View" was a ghost that read as plain text in dark.
    const actions: string[] = [];
    // A card's action bar: marked with `data-card-action`, or found — the last block of a card (a list item or a
    // rounded box) with a top border that holds only buttons or links. Found too, so markup without the mark is checked.
    const bars = new Set<Element>(document.querySelectorAll(`${root} [data-card-action]`));
    for (const card of document.querySelectorAll(`${root} li, ${root} [class*="rounded-xl"]`)) {
      const last = card.lastElementChild;
      if (!last || last === card.firstElementChild || parseFloat(getComputedStyle(last).borderTopWidth) === 0) continue;
      const controls = [...last.querySelectorAll('button, a[href]')];
      const loose = (last.textContent ?? '').replace(/\s+/g, '').length - controls.reduce((n, el) => n + (el.textContent ?? '').replace(/\s+/g, '').length, 0);
      if (controls.length && loose === 0) bars.add(last);
    }
    for (const bar of bars) {
      if (!visible(bar)) continue;
      const style = getComputedStyle(bar);
      const inner = bar.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const items = [...bar.querySelectorAll('button, a[href]')].filter(visible);
      if (!items.length) continue;
      const left = Math.min(...items.map((el) => el.getBoundingClientRect().left));
      const right = Math.max(...items.map((el) => el.getBoundingClientRect().right));
      if (right - left < inner * 0.9) actions.push(`${label(items[0])} uses ${Math.round(right - left)} of ${Math.round(inner)} px`);
      for (const el of items) {
        const s = getComputedStyle(el);
        const filled = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
        const bordered = parseFloat(s.borderTopWidth) > 0 && s.borderTopColor !== s.backgroundColor;
        if (!filled && !bordered) actions.push(`${label(el)} has no fill and no border: it reads as text`);
      }
    }

    // Copy: long visible paragraphs and team-only words.
    const copy: string[] = [];
    const banned = /\b(D\d{2}|LTR-\d+|Vercel|GitHub|npm|API token|SAMSARA_API_TOKEN|Activity Log|database|endpoint|prisma)\b/;
    for (const el of document.querySelectorAll('main p, main li, main dd, main small, main [role=note], main label, main span')) {
      // A card (an item holding its own buttons or links) is not a paragraph: its text is many short lines.
      if (!visible(el) || el.children.length > 2 || el.querySelector('button, a')) continue;
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
      if (text.length > 120) copy.push(`long (${text.length}): ${text.slice(0, 90)}…`);
      else if (banned.test(text)) copy.push(`word "${text.match(banned)?.[0]}": ${text.slice(0, 90)}`);
    }
    return { overflow, overlap: [...new Set(overlap)], gutter: [...new Set(gutter)], lonely: [...new Set(lonely)], actions: [...new Set(actions)], copy: [...new Set(copy)] };
  }, [scope, wide] as const);
}

test('tablet walk', async ({ page }, info) => {
  test.skip(process.env.TABLET_WALK !== '1', 'review tool: TABLET_WALK=1');
  test.setTimeout(900_000);
  const dir = `${OUT}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  const only = process.env.TABLET_WALK_ONLY?.split(',');
  const report: Record<string, unknown> = {};
  if (process.env.TABLET_WALK_DARK) await page.emulateMedia({ colorScheme: 'dark' });
  let signedIn = '';
  for (const [name, path, options] of PAGES) {
    if (only && !only.includes(name)) continue;
    const user = options?.user ?? MANAGER;
    if (user !== signedIn) {
      // The session also lives in the browser storage: clear it, or /login sends the old user back in.
      await page.context().clearCookies();
      await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage unavailable */ } });
      await devLogin(page, user);
      signedIn = user;
    }
    await page.goto(path);
    await page.waitForTimeout(1500);
    if (options?.open) {
      await page.getByRole('button', { name: options.open }).first().click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${dir}/${name}-1.png` });
      const inDialog = await measure(page, '[role=dialog]', false);
      report[name] = { path, ...inDialog, error: (await page.getByText('Something went wrong').count()) > 0 };
      writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
      await page.keyboard.press('Escape');
      continue;
    }
    const found: Found = { overflow: [], overlap: [], gutter: [], lonely: [], actions: [], copy: [] };
    const wide = !path.startsWith('/admin');
    const view = await page.evaluate(() => { const m = document.querySelector('main'); return { scroll: m?.scrollHeight ?? 0, view: m?.clientHeight ?? 1 }; });
    const shots = Math.min(5, Math.max(1, Math.ceil(view.scroll / Math.max(1, view.view))));
    for (let index = 0; index < shots; index += 1) {
      await page.evaluate(([i, h]) => { const m = document.querySelector('main'); if (m) m.scrollTop = Number(i) * (Number(h) - 80); }, [index, view.view] as const);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${dir}/${name}-${index + 1}.png` });
      const pass = await measure(page, 'main', wide);
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
    // A page whose data did not load (the fixture has no route for it) is a failure too, not a clean screen.
    const errors = await page.getByText(/^(Something went wrong|Fixture route not found)$/).count();
    report[name] = { path, ...found, error: errors > 0 };
    writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
  }
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));
  expect(Object.keys(report).length).toBeGreaterThan(0);
});
