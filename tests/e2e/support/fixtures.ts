import {
  test as base,
  request,
  type APIRequestContext,
  type Browser,
  type BrowserContextOptions,
} from '@playwright/test';

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
  learnerApi: async ({}, use) => use(await apiFor('learner')),
  teacherApi: async ({}, use) => use(await apiFor('teacher')),
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

/**
 * Creates an authenticated browser context.
 * Optional settings allow viewport and device emulation.
 */
export async function contextFor(
  browser: Browser,
  key: RoleKey,
  options: BrowserContextOptions = {}
) {
  return browser.newContext({
    storageState: storageStatePath(key),
    ...options,
  });
}

/**
 * Creates an authenticated mobile browser context.
 * Uses Chromium mobile emulation.
 */
export async function mobileContextFor(browser: Browser, key: RoleKey = 'learner') {
  return contextFor(browser, key, {
    viewport: {
      width: 393,
      height: 852,
    },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
}

export { ACCOUNTS };
