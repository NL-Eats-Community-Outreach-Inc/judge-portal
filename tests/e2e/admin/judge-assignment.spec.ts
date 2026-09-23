import { test, expect, ACCOUNTS, contextFor } from '../support/fixtures';
import {
  qaName,
  createEvent,
  deleteEvent,
  setEventStatus,
  addTeam,
  addCriterion,
  orgJudges,
} from '../support/api';
import { adminContextFor, expectJudgeLockedOut } from '../support/admin-page';

/**
 * Judge Assignments dialog: assign and unassign judges; the judge dashboard
 * reflects it (Phase C8, E1, E7).
 */
test.describe('Admin judge assignment', () => {
  const eventName = qaName('Judges');
  let eventId: string;

  test.beforeAll(async ({ adminApi }) => {
    eventId = (await createEvent(adminApi, eventName)).id;
    await addCriterion(adminApi, eventId, {
      name: 'QA-Tech-Merit',
      category: 'technical',
      weight: 100,
    });
    await addTeam(adminApi, eventId, { name: 'QA-Alpha', awardType: 'technical' });
    await setEventStatus(adminApi, eventId, 'active', eventName);
  });

  test.afterAll(async ({ adminApi }) => {
    await deleteEvent(adminApi, eventId, eventName);
  });

  test('assigning judges through the dialog is what the judge dashboard shows', async ({
    browser,
    adminApi,
  }) => {
    const available = await orgJudges(adminApi, eventId);
    expect(available.map((j) => j.email)).toEqual(
      expect.arrayContaining([ACCOUNTS.judge1.email, ACCOUNTS.judge2.email, ACCOUNTS.judge3.email])
    );

    const admin = await adminContextFor(browser, eventId);
    const page = await admin.newPage();
    await page.goto('/admin');
    await page
      .locator('h4', { hasText: eventName })
      .locator('xpath=ancestor::div[contains(@class,"p-4")][1]')
      .getByTitle('Manage Judge Assignments')
      .click();
    const dialog = page.getByRole('dialog', { name: 'Judge Assignments' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(ACCOUNTS.judge1.email).check();
    await dialog.getByLabel(ACCOUNTS.judge2.email).check();
    await dialog.getByRole('button', { name: 'Save Assignments' }).click();
    await expect(dialog).toBeHidden();

    const assigned = (await (
      await adminApi.get(`/api/admin/event-judges?eventId=${eventId}`)
    ).json()) as {
      assigned: Array<{ email: string }>;
    };
    expect(assigned.assigned.map((a) => a.email).sort()).toEqual(
      [ACCOUNTS.judge1.email, ACCOUNTS.judge2.email].sort()
    );

    // judge 1 sees the event and can open it; judge 3 does not
    const judge1 = await contextFor(browser, 'judge1');
    const j1 = await judge1.newPage();
    await j1.goto('/judge');
    await expect(j1.getByText(eventName)).toBeVisible();
    await j1.goto(`/judge/event/${eventId}`);
    await expect(j1.getByText('1. QA-Alpha')).toBeVisible();
    await judge1.close();

    const judge3 = await contextFor(browser, 'judge3');
    const j3 = await judge3.newPage();
    await j3.goto('/judge');
    await expect(j3.getByText(eventName)).toHaveCount(0);
    await j3.goto(`/judge/event/${eventId}`);
    await expectJudgeLockedOut(j3);
    await judge3.close();

    // unassign judge 2 through the dialog
    await page
      .locator('h4', { hasText: eventName })
      .locator('xpath=ancestor::div[contains(@class,"p-4")][1]')
      .getByTitle('Manage Judge Assignments')
      .click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Removing judges from an active event/)).toBeVisible();
    await dialog.getByLabel(ACCOUNTS.judge2.email).uncheck();
    await dialog.getByRole('button', { name: 'Save Assignments' }).click();
    await expect(dialog).toBeHidden();

    const judge2 = await contextFor(browser, 'judge2');
    const j2 = await judge2.newPage();
    await j2.goto(`/judge/event/${eventId}`);
    await expectJudgeLockedOut(j2);
    await judge2.close();

    await admin.close();
  });
});
