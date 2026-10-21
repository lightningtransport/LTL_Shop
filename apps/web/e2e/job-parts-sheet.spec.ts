import { expect, test } from './support/test';
import { devLogin } from './support/dev-login';

// D47 / LTR-247: one "Parts…" on the Job (it replaces "Add parts invoice", "Parts from stock" and "Tires to put").
const WO = '00000000-0000-4000-8000-000000000106';
const JOB = '00000000-0000-4000-8000-000000000506';
const PM_JOB = '00000000-0000-4000-8000-0000000005f1';

test.describe('LTR-247 one Parts… sheet on the Job', () => {
  test('The Job menu has one Parts…; the sheet offers From stock and Buy for this Job, which comes back here', async ({ page }) => {
    await devLogin(page, 'manager@lightning.local');
    await page.goto(`/admin/work-orders/${WO}`);
    await page.getByRole('button', { name: 'Actions for Inspect brake chamber', exact: true }).click();
    await expect(page.getByTestId('admin-wo-job-parts')).toBeVisible();
    await expect(page.getByTestId('admin-wo-job-parts-stock')).toHaveCount(0);
    await expect(page.getByTestId('admin-wo-job-parts-invoice')).toHaveCount(0);
    await page.getByTestId('admin-wo-job-parts').click();
    const sheet = page.getByTestId('job-stock-dialog');
    await expect(page.getByRole('dialog', { name: 'Parts · Inspect brake chamber' })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'From stock' })).toBeVisible();
    const buy = sheet.getByTestId('job-parts-buy');
    await expect(buy).toHaveAttribute('href', new RegExp(`jobId=${JOB}&from=${encodeURIComponent(`/admin/work-orders/${WO}`)}`));
    await expect(sheet.getByTestId('job-parts-total')).toHaveText('Parts on this Job · $0.00');
    await expect(sheet.getByTestId('job-parts-pm-preview')).toHaveCount(0);
  });

  test('On the PM Job, the sheet says what completing it will charge, per part, and flags a truck purchase with no Job', async ({ page }) => {
    await page.route(`**/api/admin/work-orders/${WO}`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      body.jobs = [...body.jobs, {
        ...body.jobs[0], id: PM_JOB, displayName: 'PM A Service', status: 'to_do',
        category: { id: '00000000-0000-4000-8000-000000000303', name: 'PM' }, parts: [], stockParts: [], tires: [],
      }];
      await route.fulfill({ response, json: body });
    });
    await page.route(`**/api/admin/parts-costs/jobs/${PM_JOB}/pm-preview`, (route) => route.fulfill({
      json: {
        parts: [
          { partId: '00000000-0000-4000-8000-00000000a001', displayName: 'Fuel Filter 4 Micron', partNumber: 'LFF8897', status: 'from_stock', unitCostCents: 2410 },
          { partId: '00000000-0000-4000-8000-00000000a002', displayName: 'Fuel Filter Volvo', partNumber: 'WF10447', status: 'not_in_stock', unitCostCents: null },
        ],
        oilCents: 8500,
        truckPurchasesWithoutJob: [{ purchaseId: '00000000-0000-4000-8000-00000000b001', invoiceNumber: '88412093', partId: '00000000-0000-4000-8000-00000000a002' }],
      },
    }));
    await devLogin(page, 'manager@lightning.local');
    await page.goto(`/admin/work-orders/${WO}`);
    await page.getByRole('button', { name: 'Actions for PM A Service', exact: true }).click();
    await page.getByTestId('admin-wo-job-parts').click();
    const preview = page.getByTestId('job-parts-pm-preview');
    await expect(preview.locator('[data-status="from_stock"]')).toContainText('Leaves stock · $24.10');
    await expect(preview.locator('[data-status="not_in_stock"]')).toContainText('Not in stock · not charged');
    await expect(preview).toContainText('On completing · $109.10');
    await expect(page.getByTestId('job-parts-pm-loose')).toContainText('Purchase 88412093 has Fuel Filter Volvo with no Job');
    // The PM takes its parts by itself: the picked ones are not offered from stock.
    const sheet = page.getByTestId('job-stock-dialog');
    await expect(sheet.getByRole('heading', { name: 'Other parts from stock' })).toBeVisible();
    await expect(sheet.locator('#job-stock-part option', { hasText: 'Fuel Filter 4 Micron' })).toHaveCount(0);
  });
});
