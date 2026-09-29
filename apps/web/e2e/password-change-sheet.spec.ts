import { expect, test, type Page, type Route } from './support/test';
import { devLogin } from './support/dev-login';

const pmUser = {
  id: 'pm-1',
  email: 'pm@example.com',
  name: 'Dana PM',
  role: 'mechanic',
  active: true,
  pmAuthorized: true,
  capabilities: ['mechanic.pm'],
  mustChangePassword: false,
};

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockPmHome(page: Page, mustChangePassword: boolean) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return json(route, { user: { ...pmUser, mustChangePassword } });
    if (path === '/api/work-orders') return json(route, { created: [], active: [], paused: [], completed: [] });
    if (path === '/api/admin/session') return json(route, {});
    return json(route, {});
  });
}

async function loginPm(page: Page) {
  await devLogin(page);
  await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible({ timeout: 15_000 });
}

test.describe('MPM update password sheet', () => {
  test('profile menu does not open the sheet when a password change is not required', async ({ page }) => {
    await mockPmHome(page, false);
    await loginPm(page);

    await page.getByRole('button', { name: 'Open profile for Dana PM' }).click();
    await expect(page.getByRole('heading', { name: 'Dana PM' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Update password' })).toHaveCount(0);
    await expect(page.getByLabel('New password')).toHaveCount(0);

    await page.getByRole('button', { name: 'Close profile' }).click();
    await page.getByRole('button', { name: 'Open profile for Dana PM' }).click();
    await expect(page.getByRole('heading', { name: 'Update password' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('required sheet opens from the menu once, then stays dismissed in English and Spanish', async ({ page }) => {
    await mockPmHome(page, true);
    await loginPm(page);

    await page.getByRole('button', { name: 'Open profile for Dana PM' }).click();
    await expect(page.getByRole('heading', { name: 'Update password' })).toBeVisible();
    await expect(page.getByText('Your account policy requires a new password for this session.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByRole('heading', { name: 'Update password' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Open profile for Dana PM' }).click();
    await expect(page.getByRole('heading', { name: 'Update password' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await page.getByRole('button', { name: 'Close profile' }).click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Open profile for Dana PM' }).click();
    await expect(page.getByRole('heading', { name: 'Update password' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close profile' }).click();

    await page.evaluate(() => sessionStorage.removeItem('ltl_shop_password_change_resolved'));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'PM Mechanic' })).toBeVisible({ timeout: 15_000 });
    // A required password change opens its sheet before the profile menu, so set the language directly.
    await page.evaluate(() => { document.cookie = 'ltl_shop_locale=es; path=/'; });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Mecánico de PM' })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir perfil de Dana PM' }).click();
    await expect(page.getByRole('heading', { name: 'Actualizar contraseña' })).toBeVisible();
    await expect(page.getByText('La política de tu cuenta exige una nueva contraseña para esta sesión.')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar actualización de contraseña' }).click();

    await page.getByRole('button', { name: 'Abrir perfil de Dana PM' }).click();
    await expect(page.getByRole('heading', { name: 'Actualizar contraseña' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });
});
