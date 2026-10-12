import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';

// OPEN_ISSUES §1s (PF2, PF4, PF5): the Admin answers in one trip and never hides rows it already has.
const WO_ID = '00000000-0000-4000-8000-000000000101';
const DETAIL_PATH = `/api/admin/work-orders/${WO_ID}`;

function pathnameOf(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

const skeletons = (page: Page) => page.locator('[role="status"].animate-pulse');

test.describe('Speed and feel (PF2, PF4, PF5)', () => {
  test('PF2: a Work Order action writes its answer to the screen without asking for the Work Order again', async ({ page }) => {
    const detailGets: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'GET' && pathnameOf(request.url()) === DETAIL_PATH) detailGets.push(request.url());
    });
    // The fixture answers like the API: the note endpoint returns the Work Order detail it changed.
    await page.route(`**${DETAIL_PATH}/notes`, async (route) => {
      const current = await route.fetch({ url: `${new URL(route.request().url()).origin}${DETAIL_PATH}`, method: 'GET', postData: undefined });
      const detail = await current.json();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...detail, version: detail.version + 1 }) });
    });

    await devLogin(page, 'manager@lightning.local');
    await page.goto(`/admin/work-orders/${WO_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('textbox', { name: 'Add note' })).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => detailGets.length).toBeGreaterThan(0);
    const before = detailGets.length;

    await page.getByPlaceholder('Add a note for the team…').fill('Checked the air line');
    await page.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Note added.' }).first()).toBeVisible();
    await page.waitForTimeout(700);
    expect(detailGets.length, 'the action answered with the Work Order; no second GET').toBe(before);
  });

  test('PF4: changing a filter on the Work Orders list keeps the rows on screen while the new page loads', async ({ page }) => {
    let listRequests = 0;
    await page.route('**/api/admin/work-orders?*', async (route) => {
      listRequests += 1;
      if (listRequests > 1) await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });

    await devLogin(page, 'manager@lightning.local');
    await page.goto('/admin/work-orders', { waitUntil: 'domcontentloaded' });
    const firstRow = page.getByText('WO-0101').first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });

    // The e2e projects are phones: the filters live in the Filters sheet.
    await page.getByRole('button', { name: /filters/i }).first().click();
    const sheet = page.getByRole('dialog');
    // "All statuses" and the default both map to no status param, so pick a filter that changes the query.
    await sheet.getByLabel('Priority').selectOption('high,critical');
    await sheet.getByRole('button', { name: 'Apply filters' }).click();
    await expect.poll(() => listRequests).toBeGreaterThan(1);
    // While the slow answer is in flight the list is still there and no skeleton replaced it.
    await expect(firstRow).toBeVisible();
    await expect(skeletons(page)).toHaveCount(0);
    await expect(page).toHaveURL(/priority=high/);
  });

  test('PF5: the Yard board paints once; the "leaving soon" refinement never brings the skeleton back', async ({ page }) => {
    let yardRequests = 0;
    let skeletonSeenAfterPaint = false;
    await page.route('**/api/admin/yard-operations?*', async (route) => {
      yardRequests += 1;
      if (yardRequests === 2) await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });

    await devLogin(page, 'manager@lightning.local');
    await page.goto('/admin/yard-operations', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'Y-101' }).first()).toBeVisible({ timeout: 15_000 });
    // Sample for the whole window in which the second answer is pending.
    const deadline = Date.now() + 1_200;
    while (Date.now() < deadline) {
      if ((await skeletons(page).count()) > 0) skeletonSeenAfterPaint = true;
      await page.waitForTimeout(100);
    }
    expect(skeletonSeenAfterPaint, 'no second skeleton while the board refines').toBe(false);
    await expect(page.getByRole('link', { name: 'Y-101' }).first()).toBeVisible();
  });
});
