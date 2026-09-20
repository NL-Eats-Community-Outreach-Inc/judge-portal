import { test, expect, ACCOUNTS, contextFor } from '../support/fixtures';
import { qaName, createEvent, deleteEvent, setEventStatus, addTeam } from '../support/api';
import { adminContextFor, openAdminTab } from '../support/admin-page';
import { submitLoginForm } from '../support/login';
import type { Page } from '@playwright/test';

/**
 * Participant flow (Phase D): registration by deep link, team creation with a
 * join code, joining, wrong and full-team messages, rename, regenerate,
 * leaving as member and as creator (transfer), the creator removing a member,
 * joining an admin-created team with the code the Teams tab shows, the lock
 * banner when active, and two participants at the same moment: creating
 * teams, taking the last seat, and using the same name.
 */
const JOIN_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

async function openEvent(page: Page, eventId: string, eventName: string) {
  await page.goto(`/participant/event/${eventId}`);
  await expect(page.getByRole('heading', { level: 1, name: eventName })).toBeVisible();
}

async function createTeam(page: Page, name: string) {
  await page.getByText('Create a Team', { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a Team' });
  await dialog.locator('#team-name').fill(name);
  await dialog.getByRole('button', { name: 'Create Team' }).click();
  // the dialog's title changes to "Team Created!" on success
  return page.getByRole('dialog');
}

function membersCard(page: Page) {
  return page
    .locator('h3', { hasText: 'Team Members' })
    .locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
}

async function joinTeam(page: Page, code: string) {
  await page.getByText('Join a Team', { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Join a Team' });
  await dialog.locator('#join-code').fill(code);
  await dialog.getByRole('button', { name: 'Join Team' }).click();
  return dialog;
}

test.describe('Participant teams', () => {
  // the steps build on each other: a failure skips the rest instead of rerunning setup
  test.describe.configure({ mode: 'serial' });

  const eventName = qaName('Participants');
  let eventId: string;

  test.beforeAll(async ({ adminApi }) => {
    eventId = (await createEvent(adminApi, eventName, { maxTeamSize: 2 })).id;
    await setEventStatus(adminApi, eventId, 'open', eventName, 2);
  });

  test.afterAll(async ({ adminApi }) => {
    await deleteEvent(adminApi, eventId, eventName);
  });

  test('a setup event is invisible; a deep link while logged out returns to the event after login', async ({
    browser,
    adminApi,
  }) => {
    await setEventStatus(adminApi, eventId, 'setup', eventName, 2);
    const a = await contextFor(browser, 'participantA');
    const pageA = await a.newPage();
    await pageA.goto('/participant');
    await expect(pageA.getByText('Innovation Hub').first()).toBeVisible();
    await expect(pageA.getByText(eventName)).toHaveCount(0);
    await pageA.goto(`/participant/event/${eventId}`);
    await expect(pageA.getByText('Event Not Found')).toBeVisible();
    await a.close();
    await setEventStatus(adminApi, eventId, 'open', eventName, 2);

    // D2: logged-out deep link → login with next → back on the event
    const fresh = await browser.newContext();
    const page = await fresh.newPage();
    await page.goto(`/participant/event/${eventId}`);
    await expect(page).toHaveURL(/\/auth\/login\?next=/);
    await submitLoginForm(page, ACCOUNTS.participantB.email, ACCOUNTS.participantB.password);
    await page.waitForURL(new RegExp(`/participant/event/${eventId}`));
    await expect(page.getByRole('heading', { level: 1, name: eventName })).toBeVisible();
    await fresh.close();
  });

  test('register, create, duplicate name, join, wrong code, full team, rename, regenerate, leave', async ({
    browser,
    participantAApi,
    participantBApi,
  }) => {
    const a = await contextFor(browser, 'participantA');
    const b = await contextFor(browser, 'participantB');
    const pageA = await a.newPage();
    const pageB = await b.newPage();

    // D1 register from the dashboard card
    await pageA.goto('/participant');
    const card = pageA.locator('a', { hasText: eventName }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText('Open', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Register' }).click();
    await expect(
      pageA.locator('a', { hasText: eventName }).first().getByText('Registered')
    ).toBeVisible();

    await openEvent(pageB, eventId, eventName);
    await pageB.getByRole('button', { name: 'Register Now' }).click();
    await expect(pageB.getByText('Registered')).toBeVisible();

    // D3 A creates a team and gets a join code
    await openEvent(pageA, eventId, eventName);
    const created = await createTeam(pageA, 'QA-Team-A');
    await expect(created.getByText('Team Created!')).toBeVisible();
    const joinCode = (await created.locator('code').textContent())!.trim();
    expect(joinCode).toMatch(JOIN_CODE);
    await created.getByRole('button', { name: 'Done' }).click();
    await expect(created).toBeHidden();
    await expect(pageA.getByText('Join Code')).toBeVisible();
    await expect(pageA.locator('code', { hasText: joinCode })).toBeVisible();

    // D4 B tries the same name
    await openEvent(pageB, eventId, eventName);
    const dup = await createTeam(pageB, 'QA-Team-A');
    await expect(
      pageB.getByText('A team with this name already exists in this event')
    ).toBeVisible();
    await dup.getByRole('button', { name: 'Cancel' }).click();

    // D5 wrong code, then the right one
    const wrong = await joinTeam(pageB, 'ZZZZZZ');
    await expect(wrong.getByText('Invalid join code')).toBeVisible();
    await wrong.locator('#join-code').fill(joinCode);
    await wrong.getByRole('button', { name: 'Join Team' }).click();
    await expect(wrong).toBeHidden();
    await expect(pageB.getByText('Join Code')).toBeVisible();
    await expect(membersCard(pageB).getByText(ACCOUNTS.participantA.email)).toBeVisible();
    await expect(membersCard(pageB).getByText(ACCOUNTS.participantB.email)).toBeVisible();

    // D7 the team is full (max 2) for a third participant
    const myTeams = (await (await participantAApi.get('/api/participant/teams')).json()) as {
      teams: Array<{ id: string; eventId: string; memberCount: number; maxTeamSize: number }>;
    };
    const team = myTeams.teams.find((t) => t.eventId === eventId)!;
    expect(team).toMatchObject({ memberCount: 2, maxTeamSize: 2 });

    // rename (creator) and regenerate the code; B's old code stops working
    await pageA.reload();
    await pageA.locator('#edit-name').fill('QA-Team-A-Renamed');
    await pageA.getByRole('button', { name: 'Save Changes' }).click();
    await expect(pageA.getByText('Team updated!')).toBeVisible();
    await expect(pageA.getByRole('heading', { name: 'QA-Team-A-Renamed' })).toBeVisible();

    const codeCard = pageA.locator('code', { hasText: joinCode }).locator('xpath=..');
    await codeCard.getByRole('button').last().click();
    await expect(pageA.getByText('Join code regenerated!')).toBeVisible();
    const newCode = (await pageA.locator('code').first().textContent())!.trim();
    expect(newCode).toMatch(JOIN_CODE);
    expect(newCode).not.toBe(joinCode);
    const oldCode = await participantBApi.post('/api/participant/teams/join', {
      data: { joinCode },
    });
    expect(oldCode.status()).toBe(404);

    // D8 B leaves; then A (creator) leaves an empty team → deleted
    // leaving lands on the dashboard; the event page then offers create/join again
    await pageB.reload();
    await pageB.getByRole('button', { name: 'Leave Team' }).click();
    await pageB.getByRole('alertdialog').getByRole('button', { name: 'Leave Team' }).click();
    await pageB.waitForURL(/\/participant$/);
    await openEvent(pageB, eventId, eventName);
    await expect(pageB.getByText('Create a Team', { exact: true })).toBeVisible();

    await pageA.reload();
    await expect(membersCard(pageA).getByText(ACCOUNTS.participantB.email)).toHaveCount(0);
    await pageA.getByRole('button', { name: 'Leave Team' }).click();
    await expect(pageA.getByRole('alertdialog')).toContainText('You are the last member');
    await pageA.getByRole('alertdialog').getByRole('button', { name: 'Leave Team' }).click();
    await pageA.waitForURL(/\/participant$/);
    await openEvent(pageA, eventId, eventName);
    await expect(pageA.getByText('Create a Team', { exact: true })).toBeVisible();
    const gone = (await (await participantAApi.get('/api/participant/teams')).json()) as {
      teams: Array<{ eventId: string }>;
    };
    expect(gone.teams.some((t) => t.eventId === eventId)).toBe(false);

    await a.close();
    await b.close();
  });

  test('creator transfer: the earliest remaining member becomes the creator', async ({
    browser,
    participantAApi,
    participantBApi,
  }) => {
    const create = await participantAApi.post('/api/participant/teams/create', {
      data: { eventId, name: 'QA-Transfer' },
    });
    expect(create.status()).toBe(201);
    const { team } = (await create.json()) as { team: { id: string; joinCode: string } };
    const join = await participantBApi.post('/api/participant/teams/join', {
      data: { joinCode: team.joinCode },
    });
    expect(join.status()).toBe(201);

    const leave = await participantAApi.post(`/api/participant/teams/${team.id}/leave`);
    expect(await leave.json()).toEqual({ success: true, teamDeleted: false });

    const b = await contextFor(browser, 'participantB');
    const pageB = await b.newPage();
    await openEvent(pageB, eventId, eventName);
    await expect(pageB.getByRole('heading', { name: 'QA-Transfer' })).toBeVisible();
    // the creator-only controls are now B's
    await expect(pageB.getByRole('button', { name: 'Delete Team' })).toBeVisible();
    await pageB.getByRole('button', { name: 'Delete Team' }).click();
    await pageB.getByRole('alertdialog').getByRole('button', { name: 'Delete Team' }).click();
    await pageB.waitForURL(/\/participant$/);
    const gone = (await (await participantBApi.get('/api/participant/teams')).json()) as {
      teams: Array<{ eventId: string }>;
    };
    expect(gone.teams.some((t) => t.eventId === eventId)).toBe(false);
    await b.close();
  });

  test('D11: the creator removes a member, who can join again; nobody else can remove', async ({
    browser,
    participantAApi,
    participantBApi,
  }) => {
    const create = await participantAApi.post('/api/participant/teams/create', {
      data: { eventId, name: 'QA-Team-R' },
    });
    expect(create.status()).toBe(201);
    const { team } = (await create.json()) as { team: { id: string; joinCode: string } };
    expect(
      (
        await participantBApi.post('/api/participant/teams/join', {
          data: { joinCode: team.joinCode },
        })
      ).status()
    ).toBe(201);
    const members = (await (
      await participantAApi.get(`/api/participant/teams/${team.id}/members`)
    ).json()) as {
      members: Array<{ participantId: string; email: string; isCreator: boolean }>;
    };
    const idA = members.members.find((m) => m.email === ACCOUNTS.participantA.email)!.participantId;
    const idB = members.members.find((m) => m.email === ACCOUNTS.participantB.email)!.participantId;

    // B (not the creator) has no remove control and the API refuses; A cannot remove A
    const b = await contextFor(browser, 'participantB');
    const pageB = await b.newPage();
    await openEvent(pageB, eventId, eventName);
    await expect(membersCard(pageB).getByText(ACCOUNTS.participantA.email)).toBeVisible();
    await expect(pageB.getByRole('button', { name: /^Remove / })).toHaveCount(0);
    await b.close();
    const byB = await participantBApi.delete(`/api/participant/teams/${team.id}/members/${idA}`);
    expect(byB.status()).toBe(403);
    expect((await byB.json()).error_code).toBe('NOT_CREATOR');
    const self = await participantAApi.delete(`/api/participant/teams/${team.id}/members/${idA}`);
    expect(self.status()).toBe(400);
    expect((await self.json()).error_code).toBe('BAD_REQUEST');
    const stranger = await participantAApi.delete(
      `/api/participant/teams/${team.id}/members/00000000-0000-0000-0000-000000000000`
    );
    expect(stranger.status()).toBe(404);

    // A removes B from the members card, with a confirmation
    const a = await contextFor(browser, 'participantA');
    const pageA = await a.newPage();
    await openEvent(pageA, eventId, eventName);
    await expect(membersCard(pageA).getByText(ACCOUNTS.participantB.email)).toBeVisible();
    await pageA.getByRole('button', { name: `Remove ${ACCOUNTS.participantB.email}` }).click();
    await expect(pageA.getByRole('alertdialog')).toContainText(
      `Remove ${ACCOUNTS.participantB.email}?`
    );
    await pageA.getByRole('alertdialog').getByRole('button', { name: 'Remove member' }).click();
    await expect(
      pageA.getByText(`Removed ${ACCOUNTS.participantB.email} from the team`)
    ).toBeVisible();
    await expect(membersCard(pageA).getByText(ACCOUNTS.participantB.email)).toHaveCount(0);
    await expect(membersCard(pageA).getByText(ACCOUNTS.participantA.email)).toBeVisible();
    await a.close();

    // B is on no team in this event and can join again with the same code
    const teamsB = (await (await participantBApi.get('/api/participant/teams')).json()) as {
      teams: Array<{ eventId: string }>;
    };
    expect(teamsB.teams.some((t) => t.eventId === eventId)).toBe(false);
    expect(
      (
        await participantBApi.post('/api/participant/teams/join', {
          data: { joinCode: team.joinCode },
        })
      ).status()
    ).toBe(201);
    expect(
      (await participantAApi.delete(`/api/participant/teams/${team.id}/members/${idB}`)).status()
    ).toBe(200);

    // clean up
    expect((await participantAApi.delete(`/api/participant/teams/${team.id}`)).status()).toBe(200);
  });

  test('D12: the admin Teams tab shows an admin-created team’s join code, and a participant joins with it', async ({
    browser,
    adminApi,
    participantBApi,
  }) => {
    const team = await addTeam(adminApi, eventId, { name: 'QA-Admin-Team', awardType: 'both' });

    const admin = await adminContextFor(browser, eventId);
    await admin.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await admin.newPage();
    await openAdminTab(page, 'Teams', eventName);
    const row = page.getByRole('row', { name: /QA-Admin-Team/ });
    await expect(row).toBeVisible();
    const code = ((await row.locator('code').textContent()) ?? '').trim();
    expect(code).toMatch(JOIN_CODE);
    await row.getByRole('button', { name: 'Copy join code for QA-Admin-Team' }).click();
    await expect(page.getByText('Join code copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await admin.close();

    // registration is idempotent, so the case also runs on its own
    expect(
      [200, 201].includes(
        (await participantBApi.post(`/api/participant/events/${eventId}/register`)).status()
      )
    ).toBe(true);
    const join = await participantBApi.post('/api/participant/teams/join', {
      data: { joinCode: code },
    });
    expect(join.status(), await join.text()).toBe(201);
    const b = await contextFor(browser, 'participantB');
    const pageB = await b.newPage();
    await openEvent(pageB, eventId, eventName);
    await expect(pageB.getByRole('heading', { name: 'QA-Admin-Team' })).toBeVisible();
    await expect(membersCard(pageB).getByText(ACCOUNTS.participantB.email)).toBeVisible();
    await b.close();

    // clean up (the admin deletes the team; its membership goes with it)
    expect((await adminApi.delete(`/api/admin/teams/${team.id}`)).status()).toBe(200);
  });

  test('two participants creating teams at the same moment both succeed with distinct orders', async ({
    participantAApi,
    participantBApi,
  }) => {
    const [ra, rb] = await Promise.all([
      participantAApi.post('/api/participant/teams/create', {
        data: { eventId, name: 'QA-Par-1' },
      }),
      participantBApi.post('/api/participant/teams/create', {
        data: { eventId, name: 'QA-Par-2' },
      }),
    ]);
    expect([ra.status(), rb.status()]).toEqual([201, 201]);
    const [ta, tb] = await Promise.all([ra.json(), rb.json()]);
    expect(ta.team.presentationOrder).not.toBe(tb.team.presentationOrder);
    expect(ta.team.joinCode).toMatch(JOIN_CODE);
    expect(tb.team.joinCode).toMatch(JOIN_CODE);

    // clean up so the lock test starts from a known state
    for (const [api, id] of [
      [participantAApi, ta.team.id],
      [participantBApi, tb.team.id],
    ] as const) {
      expect((await api.delete(`/api/participant/teams/${id}`)).status()).toBe(200);
    }
  });

  test('two participants taking the last seat at the same moment: one joins, one is told the team is full', async ({
    adminApi,
    participantAApi,
    participantBApi,
  }) => {
    // the suite has two participant accounts, so the last seat is the only one
    const team = await addTeam(adminApi, eventId, { name: 'QA-Last-Seat', awardType: 'both' });
    await setEventStatus(adminApi, eventId, 'open', eventName, 1);
    try {
      const [ra, rb] = await Promise.all([
        participantAApi.post('/api/participant/teams/join', { data: { joinCode: team.joinCode } }),
        participantBApi.post('/api/participant/teams/join', { data: { joinCode: team.joinCode } }),
      ]);
      const statuses = [ra.status(), rb.status()].sort();
      expect(statuses, `${await ra.text()} | ${await rb.text()}`).toEqual([201, 400]);
      const refused = ra.status() === 400 ? ra : rb;
      expect((await refused.json()).error_code).toBe('TEAM_FULL');
      const onTeam = await Promise.all(
        [participantAApi, participantBApi].map(async (api) => {
          const mine = (await (await api.get('/api/participant/teams')).json()) as {
            teams: Array<{ id: string }>;
          };
          return mine.teams.some((t) => t.id === team.id);
        })
      );
      expect(onTeam.filter(Boolean)).toHaveLength(1);
    } finally {
      await setEventStatus(adminApi, eventId, 'open', eventName, 2);
      expect((await adminApi.delete(`/api/admin/teams/${team.id}`)).status()).toBe(200);
    }
  });

  test('two participants creating a team with the same name at the same moment: one wins, one gets the duplicate message', async ({
    participantAApi,
    participantBApi,
  }) => {
    const [ra, rb] = await Promise.all([
      participantAApi.post('/api/participant/teams/create', {
        data: { eventId, name: 'QA-Same-Name' },
      }),
      participantBApi.post('/api/participant/teams/create', {
        data: { eventId, name: 'QA-Same-Name' },
      }),
    ]);
    const statuses = [ra.status(), rb.status()].sort();
    expect(statuses, `${await ra.text()} | ${await rb.text()}`).toEqual([201, 400]);
    const refused = ra.status() === 400 ? ra : rb;
    expect((await refused.json()).error_code).toBe('DUPLICATE_TEAM_NAME');
    const created = ra.status() === 201 ? ra : rb;
    const winner = ra.status() === 201 ? participantAApi : participantBApi;
    const teamId = ((await created.json()) as { team: { id: string } }).team.id;
    expect((await winner.delete(`/api/participant/teams/${teamId}`)).status()).toBe(200);
  });

  test('an active event locks team formation and shows the banner', async ({
    browser,
    adminApi,
    participantAApi,
  }) => {
    const create = await participantAApi.post('/api/participant/teams/create', {
      data: { eventId, name: 'QA-Locked' },
    });
    expect(create.status()).toBe(201);
    const teamId = ((await create.json()) as { team: { id: string } }).team.id;
    await setEventStatus(adminApi, eventId, 'active', eventName, 2);

    const a = await contextFor(browser, 'participantA');
    const pageA = await a.newPage();
    await openEvent(pageA, eventId, eventName);
    await expect(pageA.getByText('Teams are locked during judging')).toBeVisible();
    await expect(pageA.getByRole('button', { name: 'Leave Team' })).toHaveCount(0);
    await expect(pageA.locator('#edit-name')).toBeDisabled();

    const rename = await participantAApi.put(`/api/participant/teams/${teamId}`, {
      data: { name: 'QA-Nope' },
    });
    expect(rename.status()).toBe(400);
    expect((await rename.json()).error_code).toBe('EVENT_NOT_OPEN');

    // D9 back to open: the controls return; then the team is removed for cleanup
    await setEventStatus(adminApi, eventId, 'open', eventName, 2);
    await pageA.reload();
    await expect(pageA.getByText('Teams are locked during judging')).toHaveCount(0);
    await expect(pageA.getByRole('button', { name: 'Leave Team' })).toBeVisible();
    expect((await participantAApi.delete(`/api/participant/teams/${teamId}`)).status()).toBe(200);
    await a.close();
  });
});
