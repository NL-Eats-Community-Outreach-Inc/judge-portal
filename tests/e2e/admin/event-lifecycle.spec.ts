import { test, expect, contextFor } from '../support/fixtures';
import { qaName, deleteEvent } from '../support/api';
import type { Page } from '@playwright/test';

/**
 * Create → edit → setup → open → active → completed → delete refused → delete
 * (Phase C1, C9–C12 and G1–G3 of the verification runbook), through the UI.
 */
const STATUS_OPTION: Record<string, RegExp> = {
  setup: /^Setup/,
  open: /^Open/,
  active: /^Active/,
  completed: /^Completed/,
};

async function openEditDialog(page: Page, eventName: string) {
  const row = page
    .locator('h4', { hasText: eventName })
    .locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
  await row.getByRole('button').nth(1).click();
  await expect(page.getByRole('dialog', { name: 'Edit Event' })).toBeVisible();
}

async function setStatusViaDialog(
  page: Page,
  eventName: string,
  status: keyof typeof STATUS_OPTION
) {
  await openEditDialog(page, eventName);
  await page.getByRole('dialog').getByRole('combobox').click();
  await page.getByRole('option', { name: STATUS_OPTION[status] }).click();
  await page.getByRole('button', { name: 'Update Event' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit Event' })).toBeHidden();
}

function eventRow(page: Page, eventName: string) {
  return page
    .locator('h4', { hasText: eventName })
    .locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
}

test.describe('Admin event lifecycle @smoke', () => {
  const eventName = qaName('Lifecycle');
  let eventId: string | undefined;

  test.afterAll(async ({ adminApi }) => {
    if (eventId) await deleteEvent(adminApi, eventId, eventName);
  });

  test('creates, edits, walks the status forward, refuses the invalid moves and deletes in setup', async ({
    browser,
    adminApi,
  }) => {
    const context = await contextFor(browser, 'admin');
    const page = await context.newPage();
    await page.goto('/admin');

    // C1 create with the runbook values
    await page.getByRole('button', { name: 'Create Event' }).first().click();
    await page.locator('#event-name').fill(eventName);
    await page
      .locator('#event-description')
      .fill('Temporary verification event. Delete after testing.');
    await page.locator('#max-team-size').fill('3');
    await page.getByRole('dialog').getByRole('button', { name: 'Create Event' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(eventRow(page, eventName)).toBeVisible();
    await expect(eventRow(page, eventName).getByText('SETUP')).toBeVisible();

    const listed = (await (await adminApi.get('/api/admin/event')).json()) as {
      events: Array<{ id: string; name: string; status: string; maxTeamSize: number | null }>;
    };
    const created = listed.events.find((e) => e.name === eventName);
    expect(created).toBeDefined();
    eventId = created!.id;
    expect(created!.maxTeamSize).toBe(3);

    // the selector switched to the new event and survives a reload
    await expect(page.getByRole('combobox').first()).toContainText(eventName);
    await page.reload();
    await expect(page.getByRole('combobox').first()).toContainText(eventName);

    // edit keeps the status
    await openEditDialog(page, eventName);
    await page.locator('#event-description').fill('Edited description');
    await page.getByRole('button', { name: 'Update Event' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit Event' })).toBeHidden();
    await expect(eventRow(page, eventName)).toContainText('Edited description');
    await expect(eventRow(page, eventName).getByText('SETUP')).toBeVisible();

    // C9 delete enabled in setup (not clicked yet)
    const trash = eventRow(page, eventName).getByRole('button').nth(2);
    await expect(trash).toBeEnabled();

    // C10 setup → open, C11 trash disabled + server guard
    await setStatusViaDialog(page, eventName, 'open');
    await expect(eventRow(page, eventName).getByText('OPEN')).toBeVisible();
    await expect(eventRow(page, eventName).getByRole('button').nth(2)).toBeDisabled();

    const refused = await adminApi.delete(`/api/admin/events/${eventId}`);
    expect(refused.status()).toBe(400);
    expect(await refused.json()).toMatchObject({
      error: 'Only events in setup can be deleted',
      error_code: 'INVALID_STATUS',
    });

    // C12 PUT with the name only keeps the status, the description and the team size
    const kept = await adminApi.put(`/api/admin/events/${eventId}`, { data: { name: eventName } });
    expect(kept.status()).toBe(200);
    expect((await kept.json()).event).toMatchObject({
      status: 'open',
      description: 'Edited description',
      maxTeamSize: 3,
    });

    // C13 a non-integer team size is refused; events cannot be created outside setup
    const badSize = await adminApi.put(`/api/admin/events/${eventId}`, {
      data: { name: eventName, maxTeamSize: 'abc' },
    });
    expect(badSize.status()).toBe(400);
    expect((await badSize.json()).error_code).toBe('BAD_REQUEST');
    const live = await adminApi.post('/api/admin/event', {
      data: { name: `${eventName}-Live`, status: 'active' },
    });
    expect(live.status()).toBe(400);
    expect((await live.json()).error_code).toBe('INVALID_STATUS');
    const names = (
      (await (await adminApi.get('/api/admin/event')).json()) as {
        events: Array<{ name: string }>;
      }
    ).events.map((e) => e.name);
    expect(names).not.toContain(`${eventName}-Live`);

    // open → active → completed
    await setStatusViaDialog(page, eventName, 'active');
    await expect(eventRow(page, eventName).getByText('ACTIVE')).toBeVisible();
    await setStatusViaDialog(page, eventName, 'completed');
    await expect(eventRow(page, eventName).getByText('COMPLETED')).toBeVisible();

    // G2 completed → setup is refused
    await openEditDialog(page, eventName);
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: STATUS_OPTION.setup }).click();
    await page.getByRole('button', { name: 'Update Event' }).click();
    await expect(page.getByText('A completed event cannot go back to setup')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(eventRow(page, eventName).getByText('COMPLETED')).toBeVisible();

    // G3 walk back to setup, then delete through the dialog
    await setStatusViaDialog(page, eventName, 'active');
    await setStatusViaDialog(page, eventName, 'open');
    await setStatusViaDialog(page, eventName, 'setup');
    await expect(eventRow(page, eventName).getByText('SETUP')).toBeVisible();

    await eventRow(page, eventName).getByRole('button').nth(2).click();
    await expect(page.getByRole('alertdialog')).toContainText(eventName);
    await page.getByRole('button', { name: 'Delete Event' }).click();
    await expect(page.locator('h4', { hasText: eventName })).toHaveCount(0);

    const after = (await (await adminApi.get('/api/admin/event')).json()) as {
      events: Array<{ id: string }>;
    };
    expect(after.events.some((e) => e.id === eventId)).toBe(false);
    eventId = undefined;
    await context.close();
  });
});
