import { expect, type Page } from '@playwright/test';

/**
 * LTR-162: the login form is server-rendered with a default dev email. Typing before React hydrates
 * lets hydration restore that default, so a "manager" login landed on /mechanic/standard. Wait until
 * React owns the input (its props are attached) before typing, and check the value before submitting.
 */
export async function waitForLoginForm(page: Page) {
  await expect(page.getByRole('button', { name: /Dev Login/i })).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const input = document.querySelector('#login-email');
    return Boolean(input && Object.keys(input).some((key) => key.startsWith('__reactProps$')));
  }, undefined, { timeout: 15_000 });
}

/** Opens /login and signs in through Dev Login. Without `email`, the form's default dev account is used. */
export async function devLogin(page: Page, email?: string) {
  await page.goto('/login');
  await waitForLoginForm(page);
  const input = page.getByLabel('Email');
  if (email) {
    await input.fill(email);
    await expect(input).toHaveValue(email);
  }
  await page.getByRole('button', { name: /Dev Login/i }).click();
  // The post-login redirect is client-side; a goto issued before it lands gets interrupted by it.
  // It can pass through "/" before the workspace route; wait for the final destination.
  await page.waitForURL((url) => url.pathname !== '/' && !url.pathname.startsWith('/login'), { timeout: 30_000 });
  // The login page may replace the location once more after the router lands; wait until the URL settles.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const landed = page.url();
    await page.waitForTimeout(750);
    if (page.url() === landed) return;
  }
}
