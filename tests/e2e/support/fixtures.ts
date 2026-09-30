import { test as base, request, type APIRequestContext, type Browser } from '@playwright/test';
import { ACCOUNTS, storageStatePath, type RoleKey } from './accounts';

/**
 * `test` with one API context per role, authenticated from the storage state
 * `global-setup.ts` saved. Specs use them to build their `QA-` fixtures and to
 * call the API the way the runbook's console checks do.
 */
type RoleApis = { [K in RoleKey as `${K}Api`]: APIRequestContext };

export const test = base.extend<RoleApis>({
  adminApi: async ({}, use) => use(await apiFor('admin')),
  judge1Api: async ({}, use) => use(await apiFor('judge1')),
  judge2Api: async ({}, use) => use(await apiFor('judge2')),
  judge3Api: async ({}, use) => use(await apiFor('judge3')),
  participantAApi: async ({}, use) => use(await apiFor('participantA')),
  participantBApi: async ({}, use) => use(await apiFor('participantB')),
  superAdminApi: async ({}, use) => use(await apiFor('superAdmin')),
});

export { expect } from '@playwright/test';

export async function apiFor(key: RoleKey): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    storageState: storageStatePath(key),
  });
}

/** A browser context signed in as `key` (one context per role, as the runbook prescribes). */
export async function contextFor(browser: Browser, key: RoleKey) {
  return browser.newContext({ storageState: storageStatePath(key) });
}

export { ACCOUNTS };
