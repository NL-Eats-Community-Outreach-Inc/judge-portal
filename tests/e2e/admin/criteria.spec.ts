import { test, expect } from '../support/fixtures';
import {
  qaName,
  createEvent,
  deleteEvent,
  setEventStatus,
  addCriterion as addCriterionViaApi,
} from '../support/api';
import {
  adminContextFor,
  openAdminTab,
  chooseOption,
  moveSortableRow,
} from '../support/admin-page';
import type { Page } from '@playwright/test';

/**
 * Criteria tab: the four runbook criteria, the weight notice, min ≥ max and
 * duplicate-name refusals, reorder persistence and the lock on active events
 * (Phase C2–C4); the server-side guard behind that lock (H10).
 */
async function addCriterion(
  page: Page,
  criterion: {
    name: string;
    category: 'Technical' | 'Business';
    weight: number;
    min?: number;
    max?: number;
  }
) {
  await page.getByRole('button', { name: 'Add Criterion' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Criterion' });
  await expect(dialog).toBeVisible();
  await dialog.locator('#criterion-name').fill(criterion.name);
  await dialog.locator('#min-score').fill(String(criterion.min ?? 1));
  await dialog.locator('#max-score').fill(String(criterion.max ?? 10));
  await dialog.locator('#weight').fill(String(criterion.weight));
  await chooseOption(page, dialog.locator('#category'), criterion.category);
  await dialog.getByRole('button', { name: 'Create Criterion' }).click();
  return dialog;
}

function rowNames(page: Page) {
  return page.locator('tbody tr td:nth-child(2) div[title]').allTextContents();
}

test.describe('Admin criteria', () => {
  const eventName = qaName('Criteria');
  let eventId: string;

  test.beforeAll(async ({ adminApi }) => {
    eventId = (await createEvent(adminApi, eventName)).id;
  });

  test.afterAll(async ({ adminApi }) => {
    await deleteEvent(adminApi, eventId, eventName);
  });

  test('adds the runbook criteria with the weight notice, refuses bad ranges and duplicates, reorders, locks when active', async ({
    browser,
    adminApi,
  }) => {
    const context = await adminContextFor(browser, eventId);
    const page = await context.newPage();
    await openAdminTab(page, 'Criteria', eventName);
    await expect(page.getByText('No scoring criteria yet')).toBeVisible();

    // C2: four criteria; technical totals 60 and business 40, so the notice shows
    await addCriterion(page, { name: 'QA-Tech-Merit', category: 'Technical', weight: 40 });
    await expect(page.getByText(/Technical weights will total 40%/)).toBeVisible();
    await addCriterion(page, { name: 'QA-Innovation', category: 'Technical', weight: 20 });
    await addCriterion(page, { name: 'QA-Biz-Viability', category: 'Business', weight: 30 });
    await addCriterion(page, { name: 'QA-Presentation', category: 'Business', weight: 10 });
    await expect(page.locator('tbody tr')).toHaveCount(4);
    expect(await rowNames(page)).toEqual([
      'QA-Tech-Merit',
      'QA-Innovation',
      'QA-Biz-Viability',
      'QA-Presentation',
    ]);
    await expect(page.locator('tbody tr').first()).toContainText('Technical');
    await expect(page.locator('tbody tr').first()).toContainText('40%');

    // C3: duplicate name is refused with the server's message
    const dup = await addCriterion(page, {
      name: 'QA-Tech-Merit',
      category: 'Technical',
      weight: 5,
    });
    await expect(page.getByText('A criterion with this name already exists')).toBeVisible();
    await dup.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(4);

    // C4: min >= max is refused before anything is sent
    const bad = await addCriterion(page, {
      name: 'QA-Bad-Range',
      category: 'Technical',
      weight: 5,
      min: 5,
      max: 3,
    });
    await expect(page.getByText('Min score must be less than max score')).toBeVisible();
    await bad.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(4);

    // a weight that would push a category past 100 is refused
    const heavy = await addCriterion(page, {
      name: 'QA-Too-Heavy',
      category: 'Business',
      weight: 70,
    });
    await expect(page.getByText(/Business criteria weights would total 110%/)).toBeVisible();
    await heavy.getByRole('button', { name: 'Cancel' }).click();

    // reorder persists: move the last criterion to the top
    const handles = page.locator('tbody tr [aria-roledescription="sortable"]');
    await expect(handles).toHaveCount(4);
    for (let index = 3; index > 0; index--) {
      await moveSortableRow(
        page,
        page.locator('tbody tr [aria-roledescription="sortable"]').nth(index),
        'up',
        '/api/admin/criteria/reorder'
      );
    }
    await expect
      .poll(async () => (await rowNames(page))[0], { timeout: 10_000 })
      .toBe('QA-Presentation');

    const persisted = (await (
      await adminApi.get(`/api/admin/criteria?eventId=${eventId}`)
    ).json()) as {
      criteria: Array<{ name: string; displayOrder: number }>;
    };
    expect(persisted.criteria.map((c) => c.name)).toEqual([
      'QA-Presentation',
      'QA-Tech-Merit',
      'QA-Innovation',
      'QA-Biz-Viability',
    ]);
    await page.reload();
    await page.getByRole('tab', { name: 'Criteria' }).click();
    await expect.poll(async () => (await rowNames(page))[0] ?? '').toBe('QA-Presentation');

    // editing is blocked once the event is active
    await setEventStatus(adminApi, eventId, 'active', eventName);
    await page.reload();
    await page.getByRole('tab', { name: 'Criteria' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Add Criterion' })).toBeDisabled();
    await expect(page.locator('tbody tr').first().getByRole('button').first()).toBeDisabled();

    await context.close();
  });

  test('H10: the API refuses every criteria write once judging has started', async ({
    adminApi,
  }) => {
    const liveName = qaName('Live');
    const liveEventId = (await createEvent(adminApi, liveName)).id;
    try {
      const criterion = await addCriterionViaApi(adminApi, liveEventId, {
        name: 'QA-Tech-Merit',
        category: 'technical',
        weight: 40,
      });
      await setEventStatus(adminApi, liveEventId, 'active', liveName);

      const edit = {
        name: 'QA-Tech-Merit',
        minScore: 1,
        maxScore: 10,
        displayOrder: 1,
        weight: 40,
        category: 'business',
      };
      const attempts = [
        adminApi.put(`/api/admin/criteria/${criterion.id}`, { data: edit }),
        adminApi.delete(`/api/admin/criteria/${criterion.id}`),
        adminApi.post('/api/admin/criteria', {
          data: {
            eventId: liveEventId,
            name: 'QA-Late',
            minScore: 1,
            maxScore: 10,
            weight: 10,
            category: 'business',
          },
        }),
        adminApi.post('/api/admin/criteria/reorder', {
          data: { eventId: liveEventId, criteriaOrders: [{ id: criterion.id, displayOrder: 2 }] },
        }),
      ];
      for (const response of await Promise.all(attempts)) {
        expect(response.status(), `${response.url()} → ${await response.text()}`).toBe(400);
        expect((await response.json()).error_code).toBe('INVALID_STATUS');
      }

      const listed = (await (
        await adminApi.get(`/api/admin/criteria?eventId=${liveEventId}`)
      ).json()) as { criteria: Array<{ id: string; category: string; displayOrder: number }> };
      expect(listed.criteria).toEqual([
        expect.objectContaining({ id: criterion.id, category: 'technical', displayOrder: 1 }),
      ]);

      // back in open the edit goes through
      await setEventStatus(adminApi, liveEventId, 'open', liveName);
      const allowed = await adminApi.put(`/api/admin/criteria/${criterion.id}`, { data: edit });
      expect(allowed.status(), await allowed.text()).toBe(200);
    } finally {
      await deleteEvent(adminApi, liveEventId, liveName);
    }
  });
});
