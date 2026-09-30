import { test, expect, ACCOUNTS, contextFor } from '../support/fixtures';
import { E2E_ORGANIZATION, storageStatePath } from '../support/accounts';
import { submitLoginForm } from '../support/login';
import {
  deleteUserByEmail,
  ensureMembership,
  ensureOrganization,
  ensureUser,
  setUserOrganization,
} from '../support/supabase-admin';

/**
 * Login page shape, wrong password, every role landing on its dashboard and
 * bounced from the other three areas, sign-out (Phase A and B1–B6).
 *
 * The sign-in/sign-out journeys use throw-away accounts: signing out revokes
 * every session of that account, which would invalidate the storage states
 * the other specs rely on.
 */
const AREAS = ['/admin', '/judge', '/participant', '/super-admin'] as const;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const JOURNEYS = [
  { role: 'admin', home: '/admin' },
  { role: 'judge', home: '/judge' },
  { role: 'participant', home: '/participant' },
  { role: 'super_admin', home: '/super-admin' },
] as const;
const PASSWORD = 'LoginJourneyPass28940!';
const emailFor = (role: string) => `qa-login-${role.replace('_', '-')}-${suffix}@example.com`;

test.describe('Login and role isolation @smoke', () => {
  test.beforeAll(async () => {
    const orgId = await ensureOrganization(E2E_ORGANIZATION.name, E2E_ORGANIZATION.slug);
    for (const { role } of JOURNEYS) {
      const userId = await ensureUser(emailFor(role), PASSWORD, role);
      if (role === 'admin') await setUserOrganization(userId, orgId);
      if (role === 'judge') await ensureMembership(orgId, userId);
    }
  });

  test.afterAll(async () => {
    for (const { role } of JOURNEYS) await deleteUserByEmail(emailFor(role));
  });

  test('the landing page links to login; the login page offers only email and password', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: /sign in/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Passwordless' })).toHaveCount(0);
    await expect(page.getByText('Forgot your password?')).toHaveCount(0);
  });

  test('a wrong password shows an error and stays on the page', async ({ page }) => {
    await submitLoginForm(page, ACCOUNTS.admin.email, 'definitely-wrong');
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('the forgot-password page points to the organizer', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page.getByText(/handled by your event organizer/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /back to login/i })).toBeVisible();
  });

  test('every protected area redirects a visitor to the login page', async ({ page }) => {
    for (const area of AREAS) {
      await page.goto(area);
      await expect(page).toHaveURL(/\/auth\/login/);
    }
    // A4: an API request without a session gets JSON, never a redirect
    const response = await page.request.get('/api/admin/event', { maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error_code: 'UNAUTHORIZED' });
  });

  for (const { role, home } of JOURNEYS) {
    test(`${role} logs in, lands on ${home}, is bounced from the other areas and signs out`, async ({
      page,
    }) => {
      await submitLoginForm(page, emailFor(role), PASSWORD);
      await page.waitForURL((url) => url.pathname.startsWith(home));

      // `/` goes to the own dashboard
      await page.goto('/');
      await expect(page).toHaveURL(new RegExp(`${home}(/|$)`));

      for (const area of AREAS) {
        if (area === home) continue;
        await page.goto(area);
        await expect(page).toHaveURL(new RegExp(`${home}(/|$)`));
      }

      await page.goto(home);
      await page.getByRole('button', { name: 'Account menu' }).click();
      await page.getByRole('menuitem', { name: 'Sign out' }).click();
      await page.waitForURL(
        (url) => url.pathname === '/' || url.pathname.startsWith('/auth/login')
      );
      await page.goto(home);
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  }

  test('the admin dashboard shows the organization and five tabs', async ({ browser }) => {
    const context = await contextFor(browser, 'admin');
    const page = await context.newPage();
    await page.goto('/admin');
    await expect(page.getByText(E2E_ORGANIZATION.name)).toBeVisible();
    for (const tab of ['Events', 'Teams', 'Criteria', 'Results', 'Users']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
    await expect(page.getByRole('tab')).toHaveCount(5);
    await context.close();
  });

  test('H2: at 375 px the admin tabs fit without clipping and keep their names', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: storageStatePath('admin'),
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/admin');
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(5);
    for (const name of ['Events', 'Teams', 'Criteria', 'Results', 'Users']) {
      await expect(page.getByRole('tab', { name })).toBeVisible();
    }
    const tablist = page.getByRole('tablist');
    const clipped = await tablist.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped).toBe(false);
    for (let i = 0; i < 5; i++) {
      const box = (await tabs.nth(i).boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
    await context.close();
  });

  test('the super admin dashboard shows Organizations and Users', async ({ browser }) => {
    const context = await contextFor(browser, 'superAdmin');
    const page = await context.newPage();
    await page.goto('/super-admin');
    await expect(page.getByRole('tab', { name: 'Organizations' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Users' })).toBeVisible();
    await context.close();
  });
});
