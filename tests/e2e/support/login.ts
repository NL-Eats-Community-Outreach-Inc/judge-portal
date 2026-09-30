import type { Page } from '@playwright/test';

/**
 * Fills the login form and submits it. The inputs are React-controlled: a
 * value typed before hydration finishes is reset by the first re-render
 * (WebKit hydrates late enough to hit this), so the fill is verified and
 * repeated until both fields hold what was typed.
 */
export async function submitLoginForm(page: Page, email: string, password: string) {
  if (!page.url().includes('/auth/login')) await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  const emailBox = page.getByLabel('Email');
  const passwordBox = page.getByLabel('Password');
  for (let attempt = 0; attempt < 5; attempt++) {
    await emailBox.fill(email);
    await passwordBox.fill(password);
    await page.waitForTimeout(250);
    if ((await emailBox.inputValue()) === email && (await passwordBox.inputValue()) === password) {
      break;
    }
  }
  await page.getByRole('button', { name: 'Login' }).click();
}
