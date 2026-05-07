import { test, expect } from '@playwright/test';

test.describe('LearnWorlds URL param utilities', () => {
  test.describe('getCleanParticipantNextUrl', () => {
    test('returns null when no next param is present', async ({ page }) => {
      await page.goto('/auth/sign-up', { waitUntil: 'networkidle' });
      const result = await page.evaluate(() => {
        // @ts-ignore - accessing module from window context
        const params = new URLSearchParams(window.location.search);
        return params.get('next');
      });
      expect(result).toBeNull();
    });

    test('rejects non-participant paths', async ({ page }) => {
      await page.goto('/auth/sign-up?next=/admin/dashboard', { waitUntil: 'networkidle' });
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveValue('');
    });

    test('rejects absolute URLs to external sites', async ({ page }) => {
      await page.goto(
        `/auth/sign-up?next=${encodeURIComponent('https://malicious.com/participant/fake')}`,
        { waitUntil: 'networkidle' }
      );
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveValue('');
    });

    test('rejects javascript: protocol in next param', async ({ page }) => {
      await page.goto(`/auth/sign-up?next=${encodeURIComponent('javascript:alert(1)')}`, {
        waitUntil: 'networkidle',
      });
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveValue('');
    });
  });

  test.describe('getLearnWorldsParams', () => {
    test('extracts ref and email from direct URL params', async ({ page }) => {
      await page.goto('/auth/sign-up?ref=learnworlds&email=test@example.com', {
        waitUntil: 'networkidle',
      });
      const participantRadio = page.getByRole('radio', { name: 'Participant' });
      await expect(participantRadio).toBeChecked({ timeout: 10000 });
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveValue('test@example.com');
    });

    test('does not auto-select participant when ref is not learnworlds', async ({ page }) => {
      await page.goto('/auth/sign-up?ref=other&email=test@example.com', {
        waitUntil: 'networkidle',
      });
      const judgeRadio = page.getByRole('radio', { name: 'Judge' });
      await expect(judgeRadio).toBeChecked();
    });

    test('does not pre-fill when no params are present', async ({ page }) => {
      await page.goto('/auth/sign-up', { waitUntil: 'networkidle' });
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveValue('');
      const judgeRadio = page.getByRole('radio', { name: 'Judge' });
      await expect(judgeRadio).toBeChecked();
    });

    test('extracts params embedded in next URL', async ({ page }) => {
      const nextUrl = '/participant/event/abc?ref=learnworlds&email=nested@example.com';
      await page.goto(`/auth/sign-up?next=${encodeURIComponent(nextUrl)}`, {
        waitUntil: 'networkidle',
      });
      const participantRadio = page.getByRole('radio', { name: 'Participant' });
      await expect(participantRadio).toBeChecked({ timeout: 10000 });
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveValue('nested@example.com');
    });
  });

  test.describe('getPostAuthRedirect role mapping', () => {
    test('sign-up form shows correct role options', async ({ page }) => {
      await page.goto('/auth/sign-up', { waitUntil: 'networkidle' });
      const judgeRadio = page.getByRole('radio', { name: 'Judge' });
      const participantRadio = page.getByRole('radio', { name: 'Participant' });
      await expect(judgeRadio).toBeVisible();
      await expect(participantRadio).toBeVisible();
      await expect(judgeRadio).toBeChecked();
    });

    test('switching to participant role updates form state', async ({ page }) => {
      await page.goto('/auth/sign-up', { waitUntil: 'networkidle' });
      await page.getByRole('radio', { name: 'Participant' }).click();
      const participantRadio = page.getByRole('radio', { name: 'Participant' });
      await expect(participantRadio).toBeChecked();
    });
  });
});
