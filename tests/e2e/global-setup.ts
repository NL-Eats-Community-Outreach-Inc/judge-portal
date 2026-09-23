import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'fs';
import {
  ACCOUNTS,
  AUTH_DIR,
  E2E_ORGANIZATION,
  storageStatePath,
  type RoleKey,
} from './support/accounts';
// playwright.config.ts loads .env.local before this module is imported
import {
  ensureUser,
  ensureOrganization,
  setUserOrganization,
  ensureMembership,
  deleteQaEvents,
} from './support/supabase-admin';
import { submitLoginForm } from './support/login';

/**
 * Runs once before the suite: makes sure the six accounts exist on the test
 * project with the expected passwords and roles (admin in the QA organization,
 * judges as its members), then signs each one in through the login form and
 * saves its storage state so the specs never spend time on the login page.
 */
export default async function globalSetup(config: FullConfig) {
  const orgId = await ensureOrganization(E2E_ORGANIZATION.name, E2E_ORGANIZATION.slug);
  for (const account of Object.values(ACCOUNTS)) {
    const userId = await ensureUser(account.email, account.password, account.role);
    if (account.role === 'admin') await setUserOrganization(userId, orgId);
    if (account.role === 'judge') await ensureMembership(orgId, userId);
  }
  // Leftovers from an interrupted run would otherwise confuse the dashboards
  await deleteQaEvents();

  const baseURL =
    config.projects[0]?.use.baseURL ?? process.env.BASE_URL ?? 'http://localhost:3000';
  mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const key of Object.keys(ACCOUNTS) as RoleKey[]) {
      const account = ACCOUNTS[key];
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await submitLoginForm(page, account.email, account.password);
      await page.waitForURL((url) => url.pathname.startsWith(account.home), { timeout: 60_000 });
      await context.storageState({ path: storageStatePath(key) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
