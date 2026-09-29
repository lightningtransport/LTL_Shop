// LTR-172: visual UI audit (not part of the Playwright suite; see README.md in this folder).
// Crawls every screen a role can reach, saves a full-page screenshot per screen and measures:
// WCAG AA text contrast, clipped text, touch targets under 44px, text under 12px, and fields
// under 16px (iOS zooms into those on focus). Output: e2e/ui-audit/output/<tag>/.
//
//   npm run ui-audit -- --roles=mechanic,manager --locale=es --scheme=dark --device=iphone --tag=es-dark
import { chromium, devices, webkit } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: process.env.UI_AUDIT_BASE_URL ?? 'http://127.0.0.1:3030' },
    engine: { type: 'string', default: 'webkit' },
    roles: { type: 'string', default: 'mechanic,daniel,manager,admin,system-admin' },
    locale: { type: 'string', default: 'es' },
    scheme: { type: 'string', default: 'light' },
    device: { type: 'string', default: 'iphone' },
    tag: { type: 'string' },
    'max-screens': { type: 'string', default: '40' },
  },
});

const BASE = args.base;
const tag = args.tag ?? `${args.engine}-${args.locale}-${args.scheme}-${args.device}`;
const OUT = fileURLToPath(new URL(`./output/${tag}/`, import.meta.url));
mkdirSync(OUT, { recursive: true });

const deviceOptions = {
  iphone: { ...devices['iPhone 13'], deviceScaleFactor: 2 },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 },
}[args.device];
if (!deviceOptions) throw new Error(`Unknown --device=${args.device} (iphone | tablet | desktop)`);
delete deviceOptions.defaultBrowserType;

// Screens a role cannot reach by following links from its landing page.
const seeds = {
  mechanic: ['/mechanic/standard/new', '/mechanic/standard/trucks', '/mechanic/standard/completed'],
  daniel: ['/mechanic/pm', '/mechanic/pm/trucks', '/mechanic/pm/completed', '/mechanic/pm/new'],
};

const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const engine = args.engine === 'chromium' ? chromium : webkit;
const browser = await engine.launch(
  args.engine === 'chromium' && existsSync(localChrome) ? { executablePath: localChrome } : {},
);

const pattern = (path) => path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id');
const report = [];

async function measure(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    // Resolves any CSS color (oklch included) to sRGB through the canvas.
    const rgba = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = '#000';
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const d = context.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const luminance = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    // Nearest solid background; gradients are skipped, so contrast over them is approximate.
    const backgroundOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const c = rgba(cs.backgroundColor);
        if (c[3] > 0.5 && !cs.backgroundImage.includes('gradient')) return c;
      }
      return rgba(getComputedStyle(document.body).backgroundColor);
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0';
    };
    const label = (el) => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.value || '')
      .trim().replace(/\s+/g, ' ').slice(0, 40);
    const textEls = [...document.querySelectorAll('body *')].filter((el) =>
      visible(el) && !el.closest('nextjs-portal') && [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));

    const lowContrast = [];
    for (const el of textEls) {
      if (el.closest('[disabled],[aria-disabled=true]')) continue;
      const cs = getComputedStyle(el);
      const fg = rgba(cs.color);
      const bg = backgroundOf(el);
      const mixed = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
      const [l1, l2] = [luminance(mixed), luminance(bg)];
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      if (ratio < (large ? 3 : 4.5)) lowContrast.push(`${ratio.toFixed(2)}:1 ${size}px "${label(el)}"`);
    }
    const clipped = textEls.filter((el) => {
      const cs = getComputedStyle(el);
      const hidesOverflow = cs.overflowX === 'hidden' || cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis';
      return (el.scrollWidth > el.clientWidth + 1 && hidesOverflow)
        || el.getBoundingClientRect().right > document.documentElement.clientWidth + 1;
    }).map((el) => `"${label(el)}" ${el.scrollWidth}>${el.clientWidth}`);
    const smallTargets = [...document.querySelectorAll('a,button,[role=button],[role=tab],input,select,textarea,summary,label[for]')]
      .filter((el) => visible(el) && !el.closest('p'))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.height < 44 || rect.width < 44)
      .map(({ el, rect }) => `${el.tagName.toLowerCase()} ${Math.round(rect.width)}x${Math.round(rect.height)} "${label(el)}"`);
    const tinyText = textEls.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
      .map((el) => `${getComputedStyle(el).fontSize} "${label(el)}"`);
    const fieldsUnder16 = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]),select,textarea')]
      .filter(visible)
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => `${getComputedStyle(el).fontSize} "${label(el)}"`);
    const unique = (list, max) => [...new Set(list)].slice(0, max);
    return {
      pageOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      lowContrast: unique(lowContrast, 15),
      clipped: unique(clipped, 15),
      smallTargets: unique(smallTargets, 20),
      tinyText: unique(tinyText, 10),
      fieldsUnder16: unique(fieldsUnder16, 10),
    };
  });
}

// The admin shell scrolls inside <main>; open every inner scroller so the full-page shot shows everything.
async function screenshot(page, file) {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4 && el.clientWidth > 300) {
        Object.assign(el.style, { overflowY: 'visible', height: 'auto', maxHeight: 'none' });
        for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
          Object.assign(p.style, { height: 'auto', maxHeight: 'none', overflow: 'visible' });
        }
      }
      // Fixed bottom bars would repeat on every stitched section of a full-page shot.
      const rect = el.getBoundingClientRect();
      if (cs.position === 'fixed' && rect.top > 200 && rect.height < 200) el.style.position = 'static';
    }
    document.documentElement.style.height = 'auto';
    document.body.style.height = 'auto';
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + file, fullPage: true });
}

// A late client-side navigation (post-login redirect, router.replace of list filters) can interrupt a goto or
// move the page after it loads, and the shot would show another screen. Retry until the page stays on `path`.
async function visit(page, path) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(900);
    if (new URL(page.url()).pathname === path) return true;
  }
  return false;
}

// The post-login redirect can pass through "/" and replace the location more than once.
async function waitForSettledUrl(page) {
  await page.waitForURL((url) => url.pathname !== '/' && !url.pathname.startsWith('/login'), { timeout: 90_000 });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const landed = page.url();
    await page.waitForTimeout(750);
    if (page.url() === landed) return;
  }
}

const roles = args.roles.split(',');
for (const role of roles) {
  const context = await browser.newContext({ ...deviceOptions, colorScheme: args.scheme });
  await context.addCookies([{ name: 'ltl_shop_locale', value: args.locale, url: BASE }]);
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  // Same hydration wait as e2e/support/dev-login.ts.
  await page.waitForFunction(() => {
    const input = document.querySelector('#login-email');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith('__reactProps$')));
  }, undefined, { timeout: 90_000 });
  if (role === roles[0]) {
    report.push({ role, path: '/login', file: 'login.png', ...(await measure(page)) });
    await screenshot(page, 'login.png');
  }
  await page.locator('#login-email').fill(`${role}@lightning.local`);
  await page.getByRole('button', { name: /Dev Login|Acceso de desarrollo/i }).click();
  await waitForSettledUrl(page);

  const queue = [new URL(page.url()).pathname, ...(seeds[role] ?? [])];
  const seen = new Set();
  let count = 0;
  while (queue.length && count < Number(args['max-screens'])) {
    const path = queue.shift();
    if (seen.has(pattern(path))) continue;
    seen.add(pattern(path));
    if (!(await visit(page, path))) {
      console.warn(`skipped ${path}: the app kept navigating to ${new URL(page.url()).pathname}`);
      continue;
    }
    count += 1;
    const slug = pattern(path).replace(/[/:]+/g, '_').replace(/^_|_$/g, '') || 'root';
    const file = `${role}-${String(count).padStart(2, '0')}-${slug}.png`;
    const metrics = await measure(page);
    const links = await page.$$eval('a[href^="/"]', (anchors) => anchors.map((a) => a.getAttribute('href').split(/[?#]/)[0]));
    await screenshot(page, file);
    report.push({ role, path, file, ...metrics });
    for (const link of links) if (!link.startsWith('/login') && !seen.has(pattern(link))) queue.push(link);
  }
  await context.close();
}
await browser.close();

writeFileSync(OUT + 'report.json', JSON.stringify(report, null, 2));
for (const r of report) {
  console.log(`${r.file}  overflowX=${r.pageOverflowsX} clipped=${r.clipped.length} lowContrast=${r.lowContrast.length} `
    + `small=${r.smallTargets.length} tiny=${r.tinyText.length} fields<16=${r.fieldsUnder16.length}`);
}
// The same finding usually repeats on every screen (header, badges); group it once with its screen count.
for (const key of ['lowContrast', 'clipped', 'smallTargets', 'tinyText', 'fieldsUnder16']) {
  const screens = new Map();
  for (const r of report) for (const finding of r[key]) screens.set(finding, (screens.get(finding) ?? 0) + 1);
  if (!screens.size) continue;
  console.log(`\n${key}`);
  for (const [finding, n] of [...screens].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${n}x ${finding}`);
}
console.log(`\nScreenshots and report.json in ${OUT}`);
