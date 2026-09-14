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
  test('manager can open a Truck from Yard Operations and start/update an assessment', async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await login(page, 'manager@lightning.local');
    await openYardOperations(page);
    await page.getByRole('link', { name: 'Y-101' }).click();
    await expect(page).toHaveURL(/\/admin\/trucks\/.*001001/);
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText('Last reported location')).toBeVisible();
    await expect(page.getByText('Presence unknown')).toHaveCount(0);
    await expect(page.getByText('Physical presence is not connected')).toHaveCount(0);
    await expect(page.getByText(/in yard/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Current Work' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Blockers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Repair history' })).toBeVisible();
    await page.getByRole('button', { name: 'Start assessment' }).click();
    await expect(page.getByText('Readiness assessment started.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inspection' })).toBeVisible();
    const readiness = page.getByRole('region', { name: 'Readiness' });
    await expect(readiness.getByText('Ready to Go needs a decision on every gate — including Not required.')).toBeVisible();
    await expect(readiness.getByText('Inspection is not evaluated yet.')).toBeVisible();
    await page.getByLabel('Outcome: Inspection').selectOption('required');
    await page.getByRole('button', { name: 'Save requirement' }).first().click();
    await expect(page.getByText('Requirement updated.')).toBeVisible();
    await expect(readiness.getByText('This still has to happen. Ready to Go stays blocked until Completed or Waived.')).toBeVisible();
    await expect(readiness.getByText('When finished, set Outcome to Completed and Save.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark Ready to Go' })).toBeDisabled();
    await expect(readiness.getByText('Resolve every readiness requirement before marking Ready to Go.')).toBeVisible();
    await expect(readiness.getByRole('link', { name: 'Start with Inspection.' })).toBeVisible();
    await expect(readiness.getByText('Inspection is required and not finished — mark Completed or Waived.')).toBeVisible();
    await page.getByLabel('Outcome: Required Work').selectOption('required');
    await page.getByRole('button', { name: 'Save requirement' }).nth(1).click();
    await expect(readiness.getByText('Required does not create a Work Order. Create/finish the WO, then set Completed.')).toBeVisible();
    await expect(readiness.getByRole('link', { name: 'New Work Order' })).toBeVisible();
    const endReview = page.getByRole('button', { name: 'End review', exact: true });
    await endReview.click();
    await expect(page.getByLabel('Reason for ending review')).toBeVisible();
    await expect(page.getByText('Ends the checklist. Does not mark Ready to Go.')).toBeVisible();
    await endReview.click();
    await expect(page.getByLabel('Reason for ending review')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByLabel('Reason for ending review')).toHaveCount(0);
    await page.getByLabel('Outcome: Inspection').selectOption('not_required');
    await page.getByRole('button', { name: 'Save requirement' }).first().click();
    await expect(page.getByText('Requirement updated.')).toBeVisible();
    await page.getByLabel('Outcome: Required Work').selectOption('not_required');
    await page.getByRole('button', { name: 'Save requirement' }).nth(1).click();
    await expect(page.getByText('Requirement updated.')).toBeVisible();
    for (const [index, requirement] of ['PM', 'Alignment', 'Detailing', 'Quality Check'].entries()) {
      await page.getByLabel(`Outcome: ${requirement}`).selectOption('not_required');
      await page.getByRole('button', { name: 'Save requirement' }).nth(index + 2).click();
      await expect(page.getByText('Requirement updated.')).toBeVisible();
    }
    await page.getByRole('button', { name: 'Mark Ready to Go' }).click();
    await expect(page.getByText('Truck marked Ready to Go.')).toBeVisible();
    await page.getByRole('button', { name: 'End review', exact: true }).click();
    await page.getByLabel('Reason for ending review').fill('Returned to service');
    await page.getByRole('button', { name: 'Confirm end review' }).click();
    await expect(page.getByText('Readiness assessment closed.')).toBeVisible();
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
