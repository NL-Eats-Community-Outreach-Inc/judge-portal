import { test, expect, ACCOUNTS } from '../support/fixtures';
import {
  qaName,
  createEvent,
  deleteEvent,
  setEventStatus,
  addCriterion,
  addTeam as addTeamViaApi,
  assignJudges,
  orgJudges,
  postScore,
  results,
} from '../support/api';
import {
  adminContextFor,
  openAdminTab,
  chooseOption,
  moveSortableRow,
} from '../support/admin-page';
import type { Page } from '@playwright/test';

/**
 * Teams tab: the four runbook teams with their award types, the duplicate-name
 * message and reorder persistence (Phase C5–C7); the server-side guard that
 * keeps a live team and its scores safe from a stale tab (H10); a renamed team keeps
 * its members and its members dialog (the update answer carries no members).
 */
const AWARD_LABEL = {
  technical: 'Technical Awards',
  business: 'Business Awards',
  both: 'General Awards',
} as const;

async function addTeam(page: Page, name: string, awardType: keyof typeof AWARD_LABEL) {
  await page.getByRole('button', { name: 'Add Team' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create New Team' });
  await expect(dialog).toBeVisible();
  await dialog.locator('#team-name').fill(name);
  await chooseOption(page, dialog.locator('#award-type'), AWARD_LABEL[awardType]);
  await dialog.getByRole('button', { name: 'Create Team' }).click();
  return dialog;
}

function rowNames(page: Page) {
  return page.locator('tbody tr td:nth-child(2)').allInnerTexts();
}

test.describe('Admin teams', () => {
  const eventName = qaName('Teams');
  let eventId: string;

  test.beforeAll(async ({ adminApi }) => {
    eventId = (await createEvent(adminApi, eventName, { maxTeamSize: 3 })).id;
  });

  test.afterAll(async ({ adminApi }) => {
    await deleteEvent(adminApi, eventId, eventName);
  });

  test('adds the runbook teams in order, refuses a duplicate name and persists a reorder', async ({
    browser,
    adminApi,
  }) => {
    const context = await adminContextFor(browser, eventId);
    const page = await context.newPage();
    await openAdminTab(page, 'Teams', eventName);
    await expect(page.getByText('No teams yet')).toBeVisible();

    // C5
    await addTeam(page, 'QA-Alpha', 'technical');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await addTeam(page, 'QA-Beta', 'business');
    await addTeam(page, 'QA-Gamma "Quoted", Team', 'both');
    await addTeam(page, 'QA-Delta', 'both');
    await expect(page.locator('tbody tr')).toHaveCount(4);
    expect((await rowNames(page)).map((n) => n.trim())).toEqual([
      'QA-Alpha',
      'QA-Beta',
      'QA-Gamma "Quoted", Team',
      'QA-Delta',
    ]);

    const listed = (await (await adminApi.get(`/api/admin/teams?eventId=${eventId}`)).json()) as {
      teams: Array<{ name: string; presentationOrder: number; awardType: string }>;
    };
    expect(listed.teams.map((t) => [t.presentationOrder, t.awardType])).toEqual([
      [1, 'technical'],
      [2, 'business'],
      [3, 'both'],
      [4, 'both'],
    ]);

    // C6: duplicate name shows the server message, nothing added
    const dup = await addTeam(page, 'QA-Alpha', 'both');
    await expect(
      page.getByText('A team with this name already exists in this event')
    ).toBeVisible();
    await dup.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(4);

    // C7: drag Delta above Alpha and check it persists, then put it back
    for (let step = 0; step < 3; step++) {
      await moveSortableRow(
        page,
        page.locator('tbody tr [aria-roledescription="sortable"]').nth(3 - step),
        'up',
        '/api/admin/teams/reorder'
      );
    }
    await expect
      .poll(async () => ((await rowNames(page))[0] ?? '').trim(), { timeout: 10_000 })
      .toBe('QA-Delta');

    await page.reload();
    await page.getByRole('tab', { name: 'Teams' }).click();
    await expect.poll(async () => ((await rowNames(page))[0] ?? '').trim()).toBe('QA-Delta');
    const reordered = (await (
      await adminApi.get(`/api/admin/teams?eventId=${eventId}`)
    ).json()) as {
      teams: Array<{ name: string; presentationOrder: number }>;
    };
    expect(reordered.teams.map((t) => t.name)).toEqual([
      'QA-Delta',
      'QA-Alpha',
      'QA-Beta',
      'QA-Gamma "Quoted", Team',
    ]);

    for (let step = 0; step < 3; step++) {
      await moveSortableRow(
        page,
        page.locator('tbody tr [aria-roledescription="sortable"]').nth(step),
        'down',
        '/api/admin/teams/reorder'
      );
    }
    await expect
      .poll(async () => ((await rowNames(page))[3] ?? '').trim(), { timeout: 10_000 })
      .toBe('QA-Delta');

    await context.close();
  });

  test('editing a team keeps its members and the members dialog still opens', async ({
    browser,
    adminApi,
    participantAApi,
  }) => {
    const membersName = qaName('Members');
    const membersEventId = (await createEvent(adminApi, membersName)).id;
    try {
      await setEventStatus(adminApi, membersEventId, 'open', membersName);
      const team = await addTeamViaApi(adminApi, membersEventId, {
        name: 'QA-Epsilon',
        awardType: 'both',
      });
      const registered = await participantAApi.post(
        `/api/participant/events/${membersEventId}/register`
      );
      expect(registered.status(), await registered.text()).toBe(201);
      const joined = await participantAApi.post('/api/participant/teams/join', {
        data: { joinCode: team.joinCode },
      });
      expect(joined.status(), await joined.text()).toBe(201);

      const context = await adminContextFor(browser, membersEventId);
      const page = await context.newPage();
      await openAdminTab(page, 'Teams', membersName);
      const row = page.getByRole('row', { name: /QA-Epsilon/ });
      await expect(row.getByRole('button', { name: '1 member' })).toBeVisible();

      // the edit control is the first action button; the PUT answer carries no members,
      // so the row must keep the ones the list loaded
      await row.locator('td').last().getByRole('button').first().click();
      const dialog = page.getByRole('dialog', { name: 'Edit Team' });
      await expect(dialog).toBeVisible();
      await dialog.locator('#team-name').fill('QA-Epsilon-Renamed');
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/admin/teams/${team.id}`) &&
          response.request().method() === 'PUT'
      );
      await dialog.getByRole('button', { name: 'Update Team' }).click();
      expect((await saved).status()).toBe(200);
      await expect(dialog).toBeHidden();

      const renamed = page.getByRole('row', { name: /QA-Epsilon-Renamed/ });
      const membersButton = renamed.getByRole('button', { name: '1 member' });
      await expect(membersButton).toBeVisible();
      await membersButton.click();
      const members = page.getByRole('dialog', { name: 'QA-Epsilon-Renamed' });
      await expect(members).toBeVisible();
      await expect(members.getByText('1 member', { exact: true })).toBeVisible();
      await expect(members.getByText(ACCOUNTS.participantA.email)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(members).toBeHidden();

      await context.close();
    } finally {
      await deleteEvent(adminApi, membersEventId, membersName);
    }
  });

  test('H10: the API refuses to delete a team while judging runs and its scores stay', async ({
    adminApi,
    judge1Api,
  }) => {
    const liveName = qaName('Live');
    const liveEventId = (await createEvent(adminApi, liveName)).id;
    try {
      const criterionId = (
        await addCriterion(adminApi, liveEventId, {
          name: 'QA-Tech-Merit',
          category: 'technical',
          weight: 40,
        })
      ).id;
      const teamId = (
        await addTeamViaApi(adminApi, liveEventId, { name: 'QA-Alpha', awardType: 'technical' })
      ).id;
      const judges = await orgJudges(adminApi, liveEventId);
      await assignJudges(
        adminApi,
        liveEventId,
        judges.filter((j) => j.email === ACCOUNTS.judge1.email).map((j) => j.id)
      );
      await setEventStatus(adminApi, liveEventId, 'active', liveName);
      const saved = await postScore(judge1Api, {
        eventId: liveEventId,
        teamId,
        criterionId,
        score: 8,
      });
      expect(saved.status(), await saved.text()).toBe(200);
      const before = await results(adminApi, liveEventId);
      expect(before.scores).toHaveLength(1);

      // the Teams tab disables the control; this is what protects against a stale tab
      const refused = await adminApi.delete(`/api/admin/teams/${teamId}`);
      expect(refused.status(), await refused.text()).toBe(400);
      expect((await refused.json()).error_code).toBe('INVALID_STATUS');

      const listed = (await (
        await adminApi.get(`/api/admin/teams?eventId=${liveEventId}`)
      ).json()) as { teams: Array<{ id: string }> };
      expect(listed.teams.map((t) => t.id)).toEqual([teamId]);
      expect((await results(adminApi, liveEventId)).scores).toEqual(before.scores);

      // the same call goes through once the event is back in open (runbook Part III rule 1)
      await setEventStatus(adminApi, liveEventId, 'open', liveName);
      const allowed = await adminApi.delete(`/api/admin/teams/${teamId}`);
      expect(allowed.status(), await allowed.text()).toBe(200);
      expect((await results(adminApi, liveEventId)).scores).toEqual([]);
    } finally {
      await deleteEvent(adminApi, liveEventId, liveName);
    }
  });

  test('H12: two admins adding teams or criteria at the same moment both succeed', async ({
    adminApi,
  }) => {
    const raceName = qaName('Race');
    const raceEventId = (await createEvent(adminApi, raceName)).id;
    try {
      const rounds: string[] = [];
      for (let round = 1; round <= 10; round++) {
        const [a, b] = await Promise.all(
          ['A', 'B'].map((side) =>
            adminApi.post('/api/admin/teams', {
              data: { eventId: raceEventId, name: `QA-Race-${round}-${side}`, awardType: 'both' },
            })
          )
        );
        rounds.push(`teams ${round}: ${a.status()}/${b.status()}`);
        const [c, d] = await Promise.all(
          (['technical', 'business'] as const).map((category) =>
            adminApi.post('/api/admin/criteria', {
              data: {
                eventId: raceEventId,
                name: `QA-Race-${round}-${category}`,
                minScore: 1,
                maxScore: 10,
                weight: 5,
                category,
              },
            })
          )
        );
        rounds.push(`criteria ${round}: ${c.status()}/${d.status()}`);
      }
      expect(
        rounds.filter((r) => !r.endsWith('201/201')),
        rounds.join('; ')
      ).toEqual([]);

      const teams = (await (
        await adminApi.get(`/api/admin/teams?eventId=${raceEventId}`)
      ).json()) as { teams: Array<{ presentationOrder: number }> };
      expect(teams.teams.map((t) => t.presentationOrder)).toEqual(
        Array.from({ length: 20 }, (_, i) => i + 1)
      );
      const criteria = (await (
        await adminApi.get(`/api/admin/criteria?eventId=${raceEventId}`)
      ).json()) as { criteria: Array<{ displayOrder: number }> };
      expect(criteria.criteria.map((c) => c.displayOrder)).toEqual(
        Array.from({ length: 20 }, (_, i) => i + 1)
      );
    } finally {
      await deleteEvent(adminApi, raceEventId, raceName);
    }
  });

  test('H7: twenty reorder calls in a row on a large event never collide', async ({ adminApi }) => {
    // 25 creates and 20 reorders of 25 rows are about two minutes against the remote database
    test.setTimeout(300_000);
    const stressName = qaName('Reorder');
    const stressEventId = (await createEvent(adminApi, stressName)).id;
    try {
      const ids: string[] = [];
      for (let i = 1; i <= 25; i++) {
        ids.push(
          (await addTeamViaApi(adminApi, stressEventId, { name: `QA-R${i}`, awardType: 'both' })).id
        );
      }
      for (let call = 0; call < 20; call++) {
        const ordered = call % 2 === 0 ? [...ids].reverse() : ids;
        const response = await adminApi.post('/api/admin/teams/reorder', {
          data: {
            eventId: stressEventId,
            teamOrders: ordered.map((id, index) => ({ id, presentationOrder: index + 1 })),
          },
        });
        expect(response.status(), `call ${call + 1}: ${await response.text()}`).toBe(200);
      }
      const listed = (await (
        await adminApi.get(`/api/admin/teams?eventId=${stressEventId}`)
      ).json()) as { teams: Array<{ id: string }> };
      expect(listed.teams.map((t) => t.id)).toEqual(ids);
    } finally {
      await deleteEvent(adminApi, stressEventId, stressName);
    }
  });
});
