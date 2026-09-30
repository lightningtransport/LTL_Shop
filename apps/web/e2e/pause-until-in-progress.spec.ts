import { expect, test, type Page } from './support/test';
import { devLogin } from './support/dev-login';
import { switchLanguage } from './support/locale';

const CREATED_ID = '00000000-0000-4000-8000-000000000103';
const IN_PROGRESS_ID = '00000000-0000-4000-8000-000000000102';
async function loginToAdmin(page: Page, email: string) {
  await devLogin(page, email);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

test('Admin Pause stays disabled on Created and enables on In Progress', async ({ page }) => {
  await loginToAdmin(page, 'manager@lightning.local');

  await page.goto(`/admin/work-orders/${CREATED_ID}`);
  // LTR-174: Pause is a header action; while it is not available the header says why.
  const pause = page.getByRole('button', { name: 'Pause Work Order' });
  await expect(pause).toBeVisible();
  await expect(pause).toBeDisabled();
  await expect(page.getByText('Pause is available after this Work Order is In Progress.')).toBeVisible();

  await switchLanguage(page, 'es');
  await expect(page.getByRole('button', { name: 'Pausar Work Order' })).toBeDisabled();
  await expect(page.getByText('La pausa está disponible cuando este Work Order está En progreso.')).toBeVisible();

  await page.goto(`/admin/work-orders/${IN_PROGRESS_ID}`);
  await expect(page.getByText('La pausa está disponible cuando este Work Order está En progreso.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pausar Work Order' }).click();
  const confirmPause = page.getByRole('button', { name: 'Confirmar pausa' });
  // LTR-168: no preselected reason; Pause confirms only once one is chosen.
  await expect(page.getByLabel('Motivo de pausa')).toBeEnabled();
  await expect(confirmPause).toBeDisabled();
  await page.getByLabel('Motivo de pausa').selectOption('waiting_for_parts');
  await expect(confirmPause).toBeEnabled();
});
