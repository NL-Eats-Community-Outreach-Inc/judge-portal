import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { contextFor } from './fixtures';

const SELECTED_EVENT_KEY = 'judgeportal.admin.selectedEventId';

/**
 * An admin browser context whose "Selected Event" is `eventId` (the dashboard
 * restores the selection from localStorage on load).
 */
export async function adminContextFor(browser: Browser, eventId: string): Promise<BrowserContext> {
  const context = await contextFor(browser, 'admin');
  await context.addInitScript(
    ([key, id]) => {
      window.localStorage.setItem(key, id);
    },
    [SELECTED_EVENT_KEY, eventId]
  );
  return context;
}

/** Opens the admin dashboard on `tab` and waits for the selected event to show. */
export async function openAdminTab(page: Page, tab: string, eventName: string) {
  await page.goto('/admin');
  await expect(page.getByRole('combobox').first()).toContainText(eventName);
  await page.getByRole('tab', { name: tab }).click();
}

/** Picks an option of the Radix select that `trigger` opens. */
export async function chooseOption(
  page: Page,
  trigger: ReturnType<Page['locator']>,
  option: string | RegExp
) {
  await trigger.click();
  await page.getByRole('option', { name: option }).click();
}

/**
 * Moves a dnd-kit sortable row one step with the keyboard sensor: focus the
 * handle, Space to lift, arrow to move, Space to drop, then waits for the
 * reorder request so successive moves never race each other.
 */
export async function moveSortableRow(
  page: Page,
  handle: ReturnType<Page['locator']>,
  direction: 'up' | 'down',
  reorderPath: string
) {
  await handle.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await page.keyboard.press(direction === 'up' ? 'ArrowUp' : 'ArrowDown');
  await page.waitForTimeout(150);
  const saved = page.waitForResponse(
    (response) => response.url().includes(reorderPath) && response.request().method() === 'POST'
  );
  await page.keyboard.press('Space');
  expect((await saved).status()).toBe(200);
}

/**
 * A judge who may not open an event sees "Cannot Access This Event" when they
 * have another active assignment and "No Active Event" when they have none.
 */
export async function expectJudgeLockedOut(page: Page) {
  await expect(
    page.getByRole('heading', { name: /Cannot Access This Event|No Active Event/ }).first()
  ).toBeVisible();
}
