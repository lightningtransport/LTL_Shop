import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';
import { switchLanguage } from './support/locale';

async function login(page: Page, email: string) {
  await devLogin(page, email);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
}

async function openYardOperations(page: Page) {
  const menu = page.getByRole('button', { name: 'Open Shop Admin navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Yard Operations' }).first().click();
}

test.describe('Admin Truck detail and readiness controls', () => {
  test('manager opens a Truck from Yard Operations and sees the Work Plan, not six gates (LTR-150)', async ({ page }) => {
    await login(page, 'manager@lightning.local');
    await openYardOperations(page);
    await page.getByRole('link', { name: 'Y-101' }).first().click();
    await expect(page).toHaveURL(/\/admin\/trucks\/.*001001/);
    // Stage 4: the Next step comes first; the Truck's data and repair history are open beside the Work Plan.
    await expect(page.getByTestId('truck-next-step')).toBeVisible();
    await expect(page.getByTestId('truck-details').getByText('Last reported location')).toBeVisible();
    await expect(page.getByText('Presence unknown')).toHaveCount(0);
    await expect(page.getByText('Physical presence is not connected')).toHaveCount(0);
    await expect(page.getByText(/in yard/i)).toHaveCount(0);
    // Current Work is gone: the Work Order chip in the header says it.
    await expect(page.getByRole('heading', { name: 'Current Work' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Work Plan', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Issues found', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Repair history' })).toBeVisible();
    // The Phase 1 six-gate editor, Mark Ready and its Blockers card are gone.
    await expect(page.getByRole('heading', { name: 'Blockers' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start assessment' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark Ready to Go' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'End review', exact: true })).toHaveCount(0);
  });

  test('A Ready to Go Truck says its Work Order is completed, not open (LTR-151, T1)', async ({ page }) => {
    await page.route(/\/api\/admin\/trucks\/[0-9a-f-]+$/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.workPlan = {
        ...body.workPlan,
        readiness: 'ready',
        phase: 'ready_to_go',
        workOrder: { id: '00000000-0000-4000-8000-0000000000aa', displayId: 'WO-RTG', status: 'completed', version: 3, primaryCategoryName: 'Engine' },
      };
      await route.fulfill({ response, json: body });
    });
    await login(page, 'manager@lightning.local');
    await openYardOperations(page);
    await page.getByRole('link', { name: 'Y-101' }).first().click();
    await expect(page.getByTestId('truck-status-chip')).toHaveText('Ready to Go');
    await expect(page.getByTestId('truck-work-order-chip')).toContainText('WO-RTG · Completed');
    await expect(page.getByTestId('operational-counts')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Current Work' })).toHaveCount(0);
  });

  test('read-only Admin sees readiness data but no mutation controls in Spanish', async ({ page }) => {
    await login(page, 'ibrain@ltransl.com');
    await openYardOperations(page);
    await page.getByRole('link', { name: 'Y-102' }).click();
    await expect(page.getByText('Truck details', { exact: true })).toBeVisible();
    await switchLanguage(page, 'es');
    await expect(page.getByTestId('truck-details').getByText('Datos del truck')).toBeVisible();
    await expect(page.getByText('Ubicación reportada')).toBeVisible();
    await expect(page.getByText('Presencia desconocida')).toHaveCount(0);
    await expect(page.getByText(/no tienes permiso para cambiar/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar evaluación' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Guardar requisito/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Marcar Listo/i })).toHaveCount(0);
  });

  test('Truck links are present from Work Orders list, detail, and dashboard attention', async ({ page }) => {
    await login(page, 'manager@lightning.local');
    await expect(page.getByRole('link', { name: /T-101/ }).first()).toHaveAttribute('href', /\/admin\/trucks\//);
    await page.getByRole('link', { name: 'Work Orders' }).first().click();
    await expect(page.getByRole('link', { name: 'T-101' }).first()).toHaveAttribute('href', /\/admin\/trucks\//);
    await page.getByRole('link', { name: 'WO-0101' }).first().click();
    await expect(page.getByRole('link', { name: 'T-101' })).toHaveAttribute('href', /\/admin\/trucks\//);
  });
});
