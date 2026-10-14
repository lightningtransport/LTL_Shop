// D40 (DA4): rehearses the Demo flow with Play against the local demo, the way the presenter will run it, and
// says step by step how it went. Each step that changes data really changes it: rebuild the demo first
// (npm run prisma:demo-local --workspace=@ltl-shop/api) and run it once per rebuild.
//
//   node e2e/demo-play/run.mjs --base=http://localhost:3042 [--speed=2] [--from=12] [--headed] [--shots]
//
// On a stop it saves a screenshot in e2e/demo-play/out/ and exits with 1. --shots also saves one at the end of
// every step (what the audience sees before the next step opens).
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: process.env.DEMO_BASE_URL ?? 'http://localhost:3042' },
    speed: { type: 'string', default: '2' },
    from: { type: 'string', default: '0' },
    headed: { type: 'boolean', default: false },
    shots: { type: 'boolean', default: false },
  },
});
const BASE = args.base;
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const STEP_TIMEOUT_MS = 120_000;
const LAST_STEP_INDEX = 56;

try {
  await fetch(`${BASE}/login`, { signal: AbortSignal.timeout(60_000) });
} catch {
  console.error(`No demo answers at ${BASE}. Start it first (npm run start:demo, docs/reference/DEMO.md).`);
  process.exit(1);
}

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: !args.headed, executablePath: existsSync(chrome) ? chrome : undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([{ name: 'ltl_shop_locale', value: 'en', url: BASE }]);
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (error) => consoleErrors.push(String(error)));

await page.goto(`${BASE}/login`);
await page.waitForFunction(() => {
  const input = document.querySelector('#login-email');
  return Boolean(input && Object.keys(input).some((key) => key.startsWith('__reactProps$')));
}, undefined, { timeout: 90_000 });
await page.locator('#login-email').fill('ms@lightning.local');
await page.getByRole('button', { name: /Enter demo mode/ }).click();
await page.waitForURL(/\/admin$/, { timeout: 60_000 });

const panel = page.getByRole('complementary', { name: 'Demo panel' });
await panel.getByRole('combobox', { name: 'Story' }).selectOption('FLOW');
const speed = Number(args.speed);
const from = Number(args.from);
await page.evaluate(([value]) => {
  const state = JSON.parse(localStorage.getItem('ltl_shop_demo'));
  localStorage.setItem('ltl_shop_demo', JSON.stringify({ ...state, speed: value }));
}, [speed]);
if (from > 0) {
  await page.evaluate(([index]) => {
    const state = JSON.parse(localStorage.getItem('ltl_shop_demo'));
    localStorage.setItem('ltl_shop_demo', JSON.stringify({ ...state, storyId: 'FLOW', stepIndex: index, started: true, playing: true }));
  }, [from]);
  await page.reload();
  await panel.getByRole('button', { name: "Go to this step's screen" }).click({ timeout: 30_000 }).catch(() => {});
} else {
  await panel.getByRole('button', { name: /^Play: the demo runs by itself/ }).click();
}

/** The saved demo state and the panel's message, or null while the page is being replaced. */
async function read() {
  try {
    return await page.evaluate(() => ({
      state: JSON.parse(localStorage.getItem('ltl_shop_demo') ?? 'null'),
      alert: [...document.querySelectorAll('#demo-panel [role="status"], #demo-panel [role="alert"]')].map((node) => node.innerText).join(' | '),
      path: location.pathname + location.search,
    }));
  } catch {
    return null;
  }
}

/** What can be tapped or filled on the screen (the open form first), to see why a step did not find its target. */
async function screenControls() {
  return page.evaluate(() => {
    const root = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter((node) => !node.closest('#demo-panel')).pop()
      ?? document.querySelector('main') ?? document.body;
    return [...root.querySelectorAll('label, input, select, textarea, button, a[href], [role="tab"]')]
      .filter((node) => !node.closest('#demo-panel'))
      .map((node) => `  ${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}${node.getAttribute('aria-label') ? ` [${node.getAttribute('aria-label')}]` : ''}: ${(node.innerText || node.value || '').trim().replace(/\s+/g, ' ').slice(0, 60)}`)
      .slice(0, 60).join('\n');
  }).catch(() => '');
}

const started = Date.now();
let lastIndex = -1;
let stepStarted = Date.now();
let result = 'unknown';
let lastShot = 0;
for (;;) {
  await page.waitForTimeout(500);
  const now = await read();
  if (!now?.state) continue;
  const { state } = now;
  // The latest shot of a step is kept: it shows the step done, while Play waits the reading time on it.
  if (args.shots && lastIndex >= 0 && state.stepIndex === lastIndex && state.playing && Date.now() - lastShot > 2500) {
    lastShot = Date.now();
    await page.screenshot({ path: `${OUT}shot-${String(lastIndex + 1).padStart(2, '0')}.png` }).catch(() => {});
  }
  if (state.stepIndex !== lastIndex) {
    if (lastIndex >= 0) console.log(`  ✓ step ${lastIndex + 1} in ${Math.round((Date.now() - stepStarted) / 1000)} s`);
    lastIndex = state.stepIndex;
    stepStarted = Date.now();
    console.log(`→ step ${lastIndex + 1} · ${now.path}`);
  }
  if (!state.playing) {
    // The Demo flow's last step (57 steps since D41 added the inspection sheet; keep in step with scripts.spec.ts).
    if (state.stepIndex === LAST_STEP_INDEX && !/Play could not|did not save|Play stopped/.test(now.alert)) {
      result = 'done';
    } else {
      result = 'stopped';
      console.log(`✗ Play stopped on step ${lastIndex + 1} (${now.path}): ${now.alert || '(no message)'}`);
      await page.screenshot({ path: `${OUT}step-${lastIndex + 1}.png` });
      console.log(await screenControls());
    }
    break;
  }
  if (Date.now() - stepStarted > STEP_TIMEOUT_MS) {
    result = 'stuck';
    console.log(`✗ Step ${lastIndex + 1} did not finish in ${STEP_TIMEOUT_MS / 1000} s (${now.path})`);
    await page.screenshot({ path: `${OUT}step-${lastIndex + 1}-stuck.png` });
    break;
  }
}
console.log(`${result === 'done' ? '✓ The whole flow played' : '✗ Not finished'} in ${Math.round((Date.now() - started) / 1000)} s.`);
if (consoleErrors.length) console.log(`Page errors:\n  ${consoleErrors.slice(0, 10).join('\n  ')}`);
await browser.close();
process.exit(result === 'done' ? 0 : 1);
