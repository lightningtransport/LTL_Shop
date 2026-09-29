import { expect, type Page } from '@playwright/test';

/**
 * LTR-167: language lives in the profile menu (mechanic and Admin headers). Opens the menu, picks the
 * language by its native name, and closes the menu again.
 */
export async function switchLanguage(page: Page, locale: 'en' | 'es') {
  await page.getByRole('button', { name: /^(Open profile for|Abrir perfil de) / }).click();
  const menu = page.getByRole('dialog');
  const option = menu.getByRole('button', { name: locale === 'es' ? 'Español' : 'English', exact: true });
  await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true');
  await menu.getByRole('button', { name: /^(Close profile|Cerrar perfil)$/ }).click();
  await expect(menu).toHaveCount(0);
}
