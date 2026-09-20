import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ARTIFACTS = process.env.LTR_ARTIFACTS || '/opt/cursor/artifacts';

async function screenshot(page: Page, name: string) {
  try {
    mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({
      path: path.join(ARTIFACTS, `${name}.png`),
    });
  } catch {
    // Walkthrough capture is optional outside the Cloud Agent environment.
  }
}

async function login(page: Page, email: string, landed: RegExp) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /Dev Login/i }).click();
  await expect(page).toHaveURL(landed, { timeout: 20_000 });
}

test.describe('LTR-44 visible create / finish feedback', () => {
  test('create WO and mechanic finish show EN success banners', async ({ page }) => {
    await login(page, 'manager@lightning.local', /\/admin/);
    await page.goto('/admin/work-orders/new');
    await expect(page.getByRole('heading', { name: /New Work Order|Nueva Work Order/ })).toBeVisible();

    let selectedTruck = false;
    for (const truckNumber of ['922', '968', '905']) {
      await page.getByLabel('Truck number').fill(truckNumber);
      const option = page.getByRole('option').first();
      if (!(await option.isVisible().catch(() => false))) continue;
      await option.click();
      if (await page.getByText(/already has an open Work Order|ya tiene una Work Order abierta/).isVisible().catch(() => false)) {
        await page.getByRole('button', { name: /Change truck|Cambiar unidad/ }).click();
        continue;
      }
      selectedTruck = true;
      break;
    }
    expect(selectedTruck).toBeTruthy();
    const continueToWork = page.getByRole('button', { name: 'Continue to work' });
    if (await continueToWork.isVisible()) await continueToWork.click();

    await page.getByLabel('Category').first().selectOption({ label: 'Air & Brake System' });
    await page.getByLabel('Custom job name').fill('LTR-44 feedback smoke');
    await page.getByRole('button', { name: 'Add custom job' }).click();
    const review = page.getByRole('button', { name: 'Review Work Order' });
    if (await review.isVisible()) await review.click();

    const assignee = page.getByLabel(/Assign mechanic: LTR-44 feedback smoke/);
    if (await assignee.count()) await assignee.selectOption({ label: 'Alejandro 1' });

    await page.route('**/api/admin/work-orders', async (route) => {
      if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });
    await page.route('**/api/work-orders/**/jobs/**/complete', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });

    const create = page.getByRole('button', { name: 'Create Work Order' });
    await expect(create).toBeEnabled();
    await create.click();
    await expect(page.getByRole('button', { name: /Creating|Creando/ })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/work-orders\/[0-9a-f-]+/, { timeout: 20_000 });
    await expect(page.getByText(/Work Order created\.|Work Order creada\./)).toBeVisible();
    await expect(page.getByRole('heading', { name: /WO-/ })).toBeVisible();
    await screenshot(page, 'create_wo_success_banner');

    const detailUrl = page.url();
    const workOrderId = detailUrl.match(/\/admin\/work-orders\/([0-9a-f-]+)/i)?.[1];
    expect(workOrderId).toBeTruthy();

    await login(page, 'mechanic@lightning.local', /\/mechanic\/standard/);
    await page.goto(`/work-orders/${workOrderId}`);
    await expect(page.getByRole('heading', { name: /WO-/ })).toBeVisible();
    const start = page.getByRole('button', { name: /Start Work|Iniciar trabajo/ });
    if (await start.isVisible()) {
      await start.click();
      await expect(start).toHaveCount(0);
    }

    await page.getByRole('button', { name: /LTR-44 feedback smoke/ }).click();
    await expect(page.getByRole('dialog', { name: 'JOB FINISHED' })).toBeVisible();
    await page.getByLabel(/Completion note|Nota al completar/).fill('Replaced chamber, road-tested');
    await page.getByRole('button', { name: /Complete Job|Completar Job/ }).click();
    await expect(page.getByRole('button', { name: /Completing|Completando/ })).toBeVisible();
    await expect(page.getByText(/Job completed\.|Job completado\./)).toBeVisible();
    await expect(page.getByText('Replaced chamber, road-tested')).toBeVisible();
    await screenshot(page, 'mechanic_finish_success_banner');
  });
});
