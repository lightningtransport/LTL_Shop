import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /Dev Login/i }).click();
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
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText('Last reported location')).toBeVisible();
    await expect(page.getByText('Presence unknown')).toHaveCount(0);
    await expect(page.getByText('Physical presence is not connected')).toHaveCount(0);
    await expect(page.getByText(/in yard/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Current Work' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Work Plan', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Issues found', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Repair history' })).toBeVisible();
    // The Phase 1 six-gate editor, Mark Ready and its Blockers card are gone.
    await expect(page.getByRole('heading', { name: 'Blockers' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start assessment' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark Ready to Go' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'End review', exact: true })).toHaveCount(0);
  });

  test('read-only Admin sees readiness data but no mutation controls in Spanish', async ({ page }) => {
    await login(page, 'ibrain@ltransl.com');
    await openYardOperations(page);
    await page.getByRole('link', { name: 'Y-102' }).click();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to Spanish' }).click();
    await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
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
