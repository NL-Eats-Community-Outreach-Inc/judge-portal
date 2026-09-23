import { test, expect, ACCOUNTS, contextFor } from '../support/fixtures';
import { E2E_ORGANIZATION } from '../support/accounts';
import {
  qaName,
  createEvent,
  deleteEvent,
  setEventStatus,
  addCriterion,
  addTeam,
  assignJudges,
  orgJudges,
  postScore,
  results,
  parseCsv,
} from '../support/api';
import {
  adminContextFor,
  expectJudgeLockedOut,
  openAdminTab,
  chooseOption,
} from '../support/admin-page';
import {
  countRows,
  deleteInvitationsFor,
  deleteUserByEmail,
  findAuthUserByEmail,
} from '../support/supabase-admin';
import { submitLoginForm } from '../support/login';
import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

/**
 * The verification runbook (documents/2026/4-VERIFICATION-RUNBOOK.md Part II, internal) as one
 * continuous pass, Phase A to H, with one browser context per role and the §3
 * dataset, including the checks added in 2026 (C13, D11, D12, E9, F10, F11,
 * H6–H12). It is the scripted form of the full pass and runs only on request:
 *
 *   RUNBOOK=1 npx playwright test tests/e2e/runbook --project=chromium
 *
 * It ends with the §6 row-count check: every table is back at its baseline.
 */
test.skip(!process.env.RUNBOOK, 'set RUNBOOK=1 to run the full verification pass');

const TABLES = [
  'organizations',
  'events',
  'teams',
  'criteria',
  'scores',
  'event_judges',
  'invitations',
  'event_participants',
  'team_members',
  'organization_members',
  'users',
];
const GAMMA = 'QA-Gamma "Quoted", Team';
const COMMENT = 'Solid "demo", well argued';
const CRITERIA = [
  { key: 'C1', name: 'QA-Tech-Merit', category: 'technical' as const, weight: 40 },
  { key: 'C2', name: 'QA-Innovation', category: 'technical' as const, weight: 20 },
  { key: 'C3', name: 'QA-Biz-Viability', category: 'business' as const, weight: 30 },
  { key: 'C4', name: 'QA-Presentation', category: 'business' as const, weight: 10 },
];
type Row = [team: string, judge: 'j1' | 'j2' | 'j3', criterion: string, score: number];
const S0: Row[] = [
  ['alpha', 'j1', 'C1', 8],
  ['alpha', 'j1', 'C2', 6],
  ['alpha', 'j2', 'C1', 7],
  ['alpha', 'j2', 'C2', 9],
  ['beta', 'j1', 'C3', 9],
  ['beta', 'j1', 'C4', 7],
  ['beta', 'j2', 'C3', 5],
  ['beta', 'j2', 'C4', 10],
  ['gamma', 'j1', 'C1', 10],
  ['gamma', 'j1', 'C2', 8],
  ['gamma', 'j1', 'C3', 6],
  ['gamma', 'j1', 'C4', 4],
  ['gamma', 'j2', 'C1', 6],
  ['gamma', 'j2', 'C2', 6],
];

function criterionCard(page: Page, name: string) {
  return page
    .locator('h3', { hasText: name })
    .locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
}

function sidebarRow(page: Page, teamName: string) {
  return page
    .locator('span', { hasText: teamName })
    .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
    .first();
}

async function sidebarStatus(page: Page, teamName: string) {
  const cls = (await sidebarRow(page, teamName).getAttribute('class')) ?? '';
  return cls.includes('border-green-200')
    ? 'green'
    : cls.includes('border-yellow-200')
      ? 'yellow'
      : 'grey';
}

test.describe('Verification runbook — full pass on the test database', () => {
  test.describe.configure({ mode: 'serial' });

  const eventName = qaName('Preflight');
  const inviteEmail = `qa-runbook-judge-${Date.now()}@example.com`;
  const ids: Record<string, string> = {};
  const judgeIds: Record<string, string> = {};
  let eventId: string;
  const baseline: Record<string, number> = {};
  let judgeApi: Record<'j1' | 'j2' | 'j3', APIRequestContext>;
  const contexts: BrowserContext[] = [];

  test.beforeAll(async ({ judge1Api, judge2Api, judge3Api }) => {
    judgeApi = { j1: judge1Api, j2: judge2Api, j3: judge3Api };
    for (const table of TABLES) baseline[table] = await countRows(table);
  });

  test.afterAll(async ({ adminApi }) => {
    for (const context of contexts) await context.close().catch(() => {});
    if (eventId) await deleteEvent(adminApi, eventId, eventName);
    await deleteInvitationsFor(inviteEmail);
    await deleteUserByEmail(inviteEmail);
  });

  async function enter(rows: Row[]) {
    for (const [team, judge, criterion, score] of rows) {
      const response = await postScore(judgeApi[judge], {
        eventId,
        teamId: ids[team],
        criterionId: ids[criterion],
        score,
      });
      expect(response.status(), await response.text()).toBe(200);
    }
  }

  test('Phase A — unauthenticated smoke', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: /sign in/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('tab', { name: 'Passwordless' })).toHaveCount(0);
    await expect(page.getByText('Forgot your password?')).toHaveCount(0);
    await page.goto('/auth/forgot-password');
    await expect(page.getByText(/handled by your event organizer/)).toBeVisible();
    const orgs = await page.request.get('/api/organizations/public');
    expect(orgs.status()).toBe(200);
    expect(
      ((await orgs.json()) as { organizations: unknown[] }).organizations.length
    ).toBeGreaterThan(0);
    for (const area of ['/admin', '/judge', '/participant', '/super-admin']) {
      await page.goto(area);
      await expect(page).toHaveURL(/\/auth\/login/);
    }
  });

  test('Phase B — dashboards per role', async ({ browser }) => {
    const admin = await contextFor(browser, 'admin');
    contexts.push(admin);
    const page = await admin.newPage();
    await page.goto('/admin');
    await expect(page.getByText(E2E_ORGANIZATION.name)).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(5);
    const judge = await contextFor(browser, 'judge1');
    contexts.push(judge);
    const j = await judge.newPage();
    await j.goto('/judge');
    await expect(j).toHaveURL(/\/judge/);
    const participant = await contextFor(browser, 'participantA');
    contexts.push(participant);
    const p = await participant.newPage();
    await p.goto('/participant');
    await expect(p.getByText('Innovation Hub').first()).toBeVisible();
    const superAdmin = await contextFor(browser, 'superAdmin');
    contexts.push(superAdmin);
    const s = await superAdmin.newPage();
    await s.goto('/super-admin');
    await expect(s.getByRole('tab', { name: 'Organizations' })).toBeVisible();
  });

  test('Phase C — the admin builds the QA event', async ({ adminApi }) => {
    const event = await createEvent(adminApi, eventName, { maxTeamSize: 3 });
    eventId = event.id;
    expect(event.status).toBe('setup');
    for (const c of CRITERIA) ids[c.key] = (await addCriterion(adminApi, eventId, c)).id;
    const dup = await adminApi.post('/api/admin/criteria', {
      data: {
        eventId,
        name: 'QA-Tech-Merit',
        minScore: 1,
        maxScore: 10,
        weight: 5,
        category: 'technical',
      },
    });
    expect((await dup.json()).error).toBe('A criterion with this name already exists');
    const badRange = await adminApi.post('/api/admin/criteria', {
      data: { eventId, name: 'QA-Bad', minScore: 5, maxScore: 3, weight: 5, category: 'technical' },
    });
    expect((await badRange.json()).error).toBe('Min score must be less than max score');

    ids.alpha = (await addTeam(adminApi, eventId, { name: 'QA-Alpha', awardType: 'technical' })).id;
    ids.beta = (await addTeam(adminApi, eventId, { name: 'QA-Beta', awardType: 'business' })).id;
    ids.gamma = (await addTeam(adminApi, eventId, { name: GAMMA, awardType: 'both' })).id;
    ids.delta = (await addTeam(adminApi, eventId, { name: 'QA-Delta', awardType: 'both' })).id;
    const dupTeam = await adminApi.post('/api/admin/teams', {
      data: { eventId, name: 'QA-Alpha' },
    });
    expect((await dupTeam.json()).error).toBe('A team with this name already exists in this event');

    for (const judge of await orgJudges(adminApi, eventId)) {
      if (judge.email === ACCOUNTS.judge1.email) judgeIds.j1 = judge.id;
      if (judge.email === ACCOUNTS.judge2.email) judgeIds.j2 = judge.id;
      if (judge.email === ACCOUNTS.judge3.email) judgeIds.j3 = judge.id;
    }
    await assignJudges(adminApi, eventId, [judgeIds.j1, judgeIds.j2]);

    await setEventStatus(adminApi, eventId, 'open', eventName, 3);
    const refused = await adminApi.delete(`/api/admin/events/${eventId}`);
    expect(await refused.json()).toMatchObject({
      error: 'Only events in setup can be deleted',
      error_code: 'INVALID_STATUS',
    });
    const kept = await adminApi.put(`/api/admin/events/${eventId}`, { data: { name: eventName } });
    const keptEvent = (
      (await kept.json()) as {
        event: { status: string; description: string | null; maxTeamSize: number | null };
      }
    ).event;
    // C12: a PUT without those fields leaves status, description and team size alone
    expect(keptEvent).toMatchObject({
      status: 'open',
      description: 'Temporary verification event. Delete after testing.',
      maxTeamSize: 3,
    });

    // C13: a bad team size is refused; events cannot be created live
    const badSize = await adminApi.put(`/api/admin/events/${eventId}`, {
      data: { name: eventName, maxTeamSize: 'abc' },
    });
    expect(badSize.status()).toBe(400);
    expect((await badSize.json()).error_code).toBe('BAD_REQUEST');
    const live = await adminApi.post('/api/admin/event', {
      data: { name: 'QA-Live', status: 'active' },
    });
    expect(live.status()).toBe(400);
    expect((await live.json()).error_code).toBe('INVALID_STATUS');
    const listed = (await (await adminApi.get('/api/admin/event')).json()) as {
      events: Array<{ name: string }>;
    };
    expect(listed.events.some((e) => e.name === 'QA-Live')).toBe(false);
  });

  test('Phase D — participants register, form teams, two at once, lock when active', async ({
    browser,
    adminApi,
    participantAApi,
    participantBApi,
  }) => {
    expect(
      (await participantAApi.post(`/api/participant/events/${eventId}/register`)).status()
    ).toBe(201);
    expect(
      (await participantBApi.post(`/api/participant/events/${eventId}/register`)).status()
    ).toBe(201);

    const create = await participantAApi.post('/api/participant/teams/create', {
      data: { eventId, name: 'QA-Team-A' },
    });
    expect(create.status()).toBe(201);
    const { team } = (await create.json()) as { team: { id: string; joinCode: string } };
    expect(team.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const dup = await participantBApi.post('/api/participant/teams/create', {
      data: { eventId, name: 'QA-Team-A' },
    });
    expect((await dup.json()).error).toBe('A team with this name already exists in this event');
    const wrong = await participantBApi.post('/api/participant/teams/join', {
      data: { joinCode: 'ZZZZZZ' },
    });
    expect((await wrong.json()).error).toBe('Invalid join code');
    expect(
      (
        await participantBApi.post('/api/participant/teams/join', {
          data: { joinCode: team.joinCode },
        })
      ).status()
    ).toBe(201);

    // leave both ways, then two creates at the same moment
    expect(
      await (await participantBApi.post(`/api/participant/teams/${team.id}/leave`)).json()
    ).toEqual({
      success: true,
      teamDeleted: false,
    });
    expect(
      await (await participantAApi.post(`/api/participant/teams/${team.id}/leave`)).json()
    ).toEqual({
      success: true,
      teamDeleted: true,
    });
    // D11: the creator removes a member; nobody else can; the member can join again
    const r = await participantAApi.post('/api/participant/teams/create', {
      data: { eventId, name: 'QA-Team-R' },
    });
    expect(r.status()).toBe(201);
    const teamR = ((await r.json()) as { team: { id: string; joinCode: string } }).team;
    expect(
      (
        await participantBApi.post('/api/participant/teams/join', {
          data: { joinCode: teamR.joinCode },
        })
      ).status()
    ).toBe(201);
    const members = (await (
      await participantAApi.get(`/api/participant/teams/${teamR.id}/members`)
    ).json()) as { members: Array<{ participantId: string; email: string }> };
    const idA = members.members.find((m) => m.email === ACCOUNTS.participantA.email)!.participantId;
    const idB = members.members.find((m) => m.email === ACCOUNTS.participantB.email)!.participantId;
    const byB = await participantBApi.delete(`/api/participant/teams/${teamR.id}/members/${idA}`);
    expect([byB.status(), (await byB.json()).error_code]).toEqual([403, 'NOT_CREATOR']);
    const self = await participantAApi.delete(`/api/participant/teams/${teamR.id}/members/${idA}`);
    expect(self.status()).toBe(400);
    const creatorA = await contextFor(browser, 'participantA');
    contexts.push(creatorA);
    const creatorPage = await creatorA.newPage();
    await creatorPage.goto(`/participant/event/${eventId}`);
    await creatorPage
      .getByRole('button', { name: `Remove ${ACCOUNTS.participantB.email}` })
      .click();
    await creatorPage
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Remove member' })
      .click();
    await expect(
      creatorPage.getByText(`Removed ${ACCOUNTS.participantB.email} from the team`)
    ).toBeVisible();
    const teamsB = (await (await participantBApi.get('/api/participant/teams')).json()) as {
      teams: Array<{ eventId: string }>;
    };
    expect(teamsB.teams.some((t) => t.eventId === eventId)).toBe(false);

    // D12: the admin Teams tab shows the team's join code with a copy button; B joins with it
    const adminTab = await adminContextFor(browser, eventId);
    contexts.push(adminTab);
    await adminTab.grantPermissions(['clipboard-read', 'clipboard-write']);
    const teamsPage = await adminTab.newPage();
    await openAdminTab(teamsPage, 'Teams', eventName);
    const rowR = teamsPage.getByRole('row', { name: /QA-Team-R/ });
    const shownCode = ((await rowR.locator('code').textContent()) ?? '').trim();
    expect(shownCode).toBe(teamR.joinCode);
    await rowR.getByRole('button', { name: 'Copy join code for QA-Team-R' }).click();
    await expect(teamsPage.getByText('Join code copied')).toBeVisible();
    expect(await teamsPage.evaluate(() => navigator.clipboard.readText())).toBe(teamR.joinCode);
    expect(
      (
        await participantBApi.post('/api/participant/teams/join', {
          data: { joinCode: shownCode },
        })
      ).status()
    ).toBe(201);
    expect(
      (await participantAApi.delete(`/api/participant/teams/${teamR.id}/members/${idB}`)).status()
    ).toBe(200);
    expect((await participantAApi.delete(`/api/participant/teams/${teamR.id}`)).status()).toBe(200);

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

    // D9 lock banner when active
    await setEventStatus(adminApi, eventId, 'active', eventName, 3);
    const a = await contextFor(browser, 'participantA');
    contexts.push(a);
    const pageA = await a.newPage();
    await pageA.goto(`/participant/event/${eventId}`);
    await expect(pageA.getByText('Teams are locked during judging')).toBeVisible();

    // D10 remove the participant teams so only the four §3 teams remain
    await setEventStatus(adminApi, eventId, 'open', eventName, 3);
    expect((await participantAApi.delete(`/api/participant/teams/${ta.team.id}`)).status()).toBe(
      200
    );
    expect((await participantBApi.delete(`/api/participant/teams/${tb.team.id}`)).status()).toBe(
      200
    );
    await setEventStatus(adminApi, eventId, 'active', eventName, 3);
  });

  test('Phase E — judges score the dataset; the API refuses the bad values', async ({
    browser,
  }) => {
    await enter(S0);
    // E4: judge 1's comment on Gamma C1 is saved together with the score (read back by F11)
    expect(
      (
        await postScore(judgeApi.j1, {
          eventId,
          teamId: ids.gamma,
          criterionId: ids.C1,
          score: 10,
          comment: COMMENT,
        })
      ).status()
    ).toBe(200);

    const half = await judgeApi.j1.post('/api/judge/scores', {
      data: { eventId, teamId: ids.alpha, criterionId: ids.C1, score: 5.5 },
    });
    expect((await half.json()).error_code).toBe('INVALID_SCORE');
    const na = await judgeApi.j1.post('/api/judge/scores', {
      data: { eventId, teamId: ids.alpha, criterionId: ids.C3, score: 5 },
    });
    expect((await na.json()).error_code).toBe('CRITERION_NOT_APPLICABLE');
    const eleven = await judgeApi.j1.post('/api/judge/scores', {
      data: { eventId, teamId: ids.alpha, criterionId: ids.C1, score: 11 },
    });
    expect((await eleven.json()).error).toBe('Score must be between 1 and 10');

    // E6 sidebar icons per judge
    for (const [key, expected] of [
      [
        'judge1',
        { 'QA-Alpha': 'green', 'QA-Beta': 'green', 'QA-Gamma': 'green', 'QA-Delta': 'grey' },
      ],
      [
        'judge2',
        { 'QA-Alpha': 'green', 'QA-Beta': 'green', 'QA-Gamma': 'yellow', 'QA-Delta': 'grey' },
      ],
    ] as const) {
      const context = await contextFor(browser, key);
      contexts.push(context);
      const page = await context.newPage();
      await page.goto(`/judge/event/${eventId}`);
      await expect(page.getByText('1. QA-Alpha').first()).toBeVisible();
      await expect
        .poll(async () => {
          const out: Record<string, string> = {};
          for (const team of Object.keys(expected)) out[team] = await sidebarStatus(page, team);
          return out;
        })
        .toEqual(expected);
    }

    // E7 judge 3 is not assigned
    const judge3 = await contextFor(browser, 'judge3');
    contexts.push(judge3);
    const page3 = await judge3.newPage();
    await page3.goto('/judge');
    await expect(page3.getByText(eventName)).toHaveCount(0);
    await page3.goto(`/judge/event/${eventId}`);
    await expectJudgeLockedOut(page3);
  });

  test('Phase F — results accuracy, exports, M1–M4', async ({ browser, adminApi }) => {
    const s0 = await results(adminApi, eventId);
    const byName = Object.fromEntries(s0.teamTotals.map((t) => [t.teamName, t]));
    expect(byName['QA-Alpha']).toMatchObject({
      totalScore: 30,
      averageScore: 15,
      weightedScore: 7.5,
      totalScores: 4,
      judgeCount: 2,
    });
    expect(byName['QA-Beta']).toMatchObject({
      totalScore: 31,
      averageScore: 15.5,
      weightedScore: 7.38,
      totalScores: 4,
      judgeCount: 2,
    });
    expect(byName[GAMMA]).toMatchObject({
      totalScore: 40,
      averageScore: 20,
      weightedScore: 5.7,
      totalScores: 6,
      judgeCount: 2,
    });
    expect(byName['QA-Delta']).toBeUndefined();
    expect(s0.scores).toHaveLength(14);

    const context = await adminContextFor(browser, eventId);
    contexts.push(context);
    const page = await context.newPage();
    await openAdminTab(page, 'Results', eventName);
    await expect(page.getByText('Total Scores').locator('xpath=preceding-sibling::p')).toHaveText(
      '14'
    );
    await expect(page.getByText('Teams Scored').locator('xpath=preceding-sibling::p')).toHaveText(
      '3'
    );
    await expect(page.getByText('Active Judges').locator('xpath=preceding-sibling::p')).toHaveText(
      '2'
    );
    await expect(
      page.getByText('Completion Rate').locator('xpath=preceding-sibling::p')
    ).toHaveText('88%');
    const rows = page.locator('table').first().locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await chooseOption(page, page.getByRole('combobox').nth(2), /Weighted Score/);
    await expect(rows.first()).toContainText('QA-Alpha');
    await expect(rows.first()).toContainText('7.50');

    for (const [mode, first] of [
      ['total', GAMMA],
      ['average', GAMMA],
      ['weighted', 'QA-Alpha'],
    ] as const) {
      const text = await (
        await adminApi.get(`/api/admin/results/export?eventId=${eventId}&scoreMode=${mode}`)
      ).text();
      expect(text).toContain('"QA-Gamma ""Quoted"", Team"');
      const csv = parseCsv(text);
      expect(csv[0].slice(0, 3)).toEqual(['Rank', 'Tied', 'Team Name']);
      expect(csv[1][2]).toBe(first);
      expect(csv.find((r) => r[2] === GAMMA)).toHaveLength(8);
      // F4: no ties in S0
      expect(csv.slice(1).map((r) => r[1])).toEqual(['', '', '']);
    }
    const matrix = parseCsv(
      await (await adminApi.get(`/api/admin/results/export-judge-scores?eventId=${eventId}`)).text()
    );
    expect(matrix[2]).toEqual([
      'QA-Alpha',
      '1',
      'Technical',
      '8',
      '6',
      'N/A',
      'N/A',
      '7',
      '9',
      'N/A',
      'N/A',
    ]);
    expect(matrix[4]).toEqual([GAMMA, '3', 'General', '10', '8', '6', '4', '6', '6', '', '']);

    // M1
    await enter([['alpha', 'j1', 'C1', 10]]);
    let alpha = (await results(adminApi, eventId)).teamTotals.find(
      (t) => t.teamName === 'QA-Alpha'
    )!;
    expect(alpha).toMatchObject({ totalScore: 32, averageScore: 16, weightedScore: 8.17 });
    // M2
    await assignJudges(adminApi, eventId, [judgeIds.j1, judgeIds.j2, judgeIds.j3]);
    await enter([['alpha', 'j3', 'C1', 1]]);
    alpha = (await results(adminApi, eventId)).teamTotals.find((t) => t.teamName === 'QA-Alpha')!;
    expect(alpha).toMatchObject({
      totalScore: 33,
      averageScore: 11,
      weightedScore: 5.67,
      totalScores: 5,
      judgeCount: 3,
    });
    // M3
    await assignJudges(adminApi, eventId, [judgeIds.j1, judgeIds.j2]);
    alpha = (await results(adminApi, eventId)).teamTotals.find((t) => t.teamName === 'QA-Alpha')!;
    expect(alpha).toMatchObject({
      totalScore: 32,
      averageScore: 16,
      weightedScore: 8.17,
      judgeCount: 2,
    });
    // M4
    await adminApi.put(`/api/admin/teams/${ids.gamma}`, {
      data: { name: GAMMA, presentationOrder: 3, awardType: 'technical' },
    });
    const gamma = (await results(adminApi, eventId)).teamTotals.find((t) => t.teamName === GAMMA)!;
    expect(gamma).toMatchObject({
      totalScore: 30,
      averageScore: 15,
      weightedScore: 7.67,
      totalScores: 4,
    });
    await adminApi.put(`/api/admin/teams/${ids.gamma}`, {
      data: { name: GAMMA, presentationOrder: 3, awardType: 'both' },
    });
    expect(
      (await results(adminApi, eventId)).teamTotals.find((t) => t.teamName === GAMMA)
    ).toMatchObject({ totalScore: 40 });

    // F10 (M5): Alpha C1 = 8, C2 = 7 ties Beta at 31 / 15.50 in Total and Average only
    await enter([
      ['alpha', 'j1', 'C1', 8],
      ['alpha', 'j1', 'C2', 7],
    ]);
    for (const [mode, expected] of [
      ['total', ['', 'yes', 'yes']],
      ['average', ['', 'yes', 'yes']],
      ['weighted', ['', '', '']],
    ] as const) {
      const csv = parseCsv(
        await (
          await adminApi.get(`/api/admin/results/export?eventId=${eventId}&scoreMode=${mode}`)
        ).text()
      );
      expect(
        csv.slice(1).map((r) => r[1]),
        mode
      ).toEqual([...expected]);
    }
    await page.reload();
    await openAdminTab(page, 'Results', eventName);
    const tieBadge = (row: number) => rows.nth(row).getByText('Tie', { exact: true });
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText('QA-Alpha');
    await expect(rows.nth(2)).toContainText('QA-Beta');
    await expect(tieBadge(0)).toHaveCount(0);
    await expect(tieBadge(1)).toBeVisible();
    await expect(tieBadge(2)).toBeVisible();
    await chooseOption(page, page.getByRole('combobox').nth(2), /Weighted Score/);
    await expect(rows.getByText('Tie', { exact: true })).toHaveCount(0);
    await enter([
      ['alpha', 'j1', 'C1', 10],
      ['alpha', 'j1', 'C2', 6],
    ]);
    expect(
      (await results(adminApi, eventId)).teamTotals.find((t) => t.teamName === 'QA-Alpha')
    ).toMatchObject({ totalScore: 32, averageScore: 16, weightedScore: 8.17 });

    // F11: the comments export, one row per counted score, the E4 comment escaped
    const commentsText = await (
      await adminApi.get(`/api/admin/results/export-comments?eventId=${eventId}`)
    ).text();
    expect(commentsText).toContain(',"Solid ""demo"", well argued"');
    const comments = parseCsv(commentsText);
    expect(comments[0]).toEqual([
      'Presentation Order',
      'Team',
      'Award Type',
      'Judge',
      'Criterion',
      'Score',
      'Comment',
    ]);
    expect(comments).toHaveLength(15);
    expect(comments.slice(1).map((r) => r[3])).not.toContain(ACCOUNTS.judge3.email);
    expect(comments.slice(1).map((r) => r[1])).not.toContain('QA-Delta');
    expect(comments.slice(1).filter((r) => r[6] !== '')).toEqual([
      ['3', GAMMA, 'General', ACCOUNTS.judge1.email, 'QA-Tech-Merit', '10', COMMENT],
    ]);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export comments' }).click();
    expect((await download).suggestedFilename()).toMatch(/^judging-comments-.*\.csv$/);
    // a name that would open as a formula is prefixed in every CSV
    const rename = (name: string) =>
      adminApi.put(`/api/admin/teams/${ids.alpha}`, {
        data: { name, presentationOrder: 1, awardType: 'technical' },
      });
    expect((await rename('=QA-Formula')).status()).toBe(200);
    for (const path of ['export', 'export-judge-scores', 'export-comments']) {
      const csv = await (
        await adminApi.get(`/api/admin/results/${path}?eventId=${eventId}`)
      ).text();
      expect(csv, path).toContain("'=QA-Formula");
      expect(csv, path).not.toContain(',=QA-Formula');
    }
    expect((await rename('QA-Alpha')).status()).toBe(200);
  });

  test('E9 and H9 — a score chosen just before leaving is saved; an expired session says so', async ({
    browser,
    adminApi,
    judge2Api,
  }) => {
    // E9: judge 2 on Delta clicks C1 = 7, switches to Alpha at once, then leaves for the dashboard
    const judge2 = await contextFor(browser, 'judge2');
    contexts.push(judge2);
    const page = await judge2.newPage();
    await page.goto(`/judge/event/${eventId}/team/${ids.delta}`);
    await expect(page.locator('h3', { hasText: 'QA-Tech-Merit' })).toBeVisible();
    await criterionCard(page, 'QA-Tech-Merit')
      .getByRole('button', { name: '7', exact: true })
      .click();
    await sidebarRow(page, 'QA-Alpha').click();
    await page.waitForURL(new RegExp(`/team/${ids.alpha}`));
    await page.goto('/judge');
    await expect
      .poll(async () => {
        const body = (await (
          await judge2Api.get(`/api/judge/scores?teamId=${ids.delta}&eventId=${eventId}`)
        ).json()) as { scores: Array<{ criterionId: string; score: number }> };
        return body.scores.find((s) => s.criterionId === ids.C1)?.score;
      })
      .toBe(7);
    await page.goto(`/judge/event/${eventId}/team/${ids.delta}`);
    await expect(
      criterionCard(page, 'QA-Tech-Merit').getByRole('button', { name: '7', exact: true })
    ).toHaveClass(/ring-2/);

    // H9: judge 1 signs out in a second tab; the first tab's next save says the session expired.
    // A fresh login gives this check its own session, so the stored one the API
    // contexts use is not the one being revoked.
    const judge1 = await browser.newContext();
    contexts.push(judge1);
    const first = await judge1.newPage();
    await submitLoginForm(first, ACCOUNTS.judge1.email, ACCOUNTS.judge1.password);
    await first.waitForURL(/\/judge/);
    await first.goto(`/judge/event/${eventId}/team/${ids.beta}`);
    await expect(first.locator('h3', { hasText: 'QA-Biz-Viability' })).toBeVisible();
    const second = await judge1.newPage();
    await second.goto('/judge');
    await second.getByRole('button', { name: 'Account menu' }).click();
    await second.getByRole('menuitem', { name: 'Sign out' }).click();
    await second.waitForURL(
      (url) => url.pathname === '/' || url.pathname.startsWith('/auth/login')
    );
    const probe = await first.evaluate(() =>
      fetch('/api/judge/teams').then((r) => [r.redirected, r.status] as const)
    );
    expect(probe).toEqual([false, 401]);
    // a new value (C3 is 9 already; the same value would be skipped as already saved)
    await criterionCard(first, 'QA-Biz-Viability')
      .getByRole('button', { name: '8', exact: true })
      .click();
    await expect(first.getByText('Your session has expired')).toBeVisible({ timeout: 10_000 });
    await sidebarRow(first, 'QA-Alpha').click();
    await expect(first).toHaveURL(/\/auth\/login/);
    // judge 1's Beta C3 = 9 was already saved in S0; nothing was lost
    const counted = (await results(adminApi, eventId)).scores;
    expect(
      counted.find(
        (s) => s.team.id === ids.beta && s.criterion.id === ids.C3 && s.judge.id === judgeIds.j1
      )?.score
    ).toBe(9);
  });

  test('Phase G — lifecycle end', async ({ adminApi, judge2Api, participantAApi }) => {
    await setEventStatus(adminApi, eventId, 'completed', eventName, 3);
    const judgeEvents = (await (await judge2Api.get('/api/judge/events')).json()) as {
      events: Array<{ id: string }>;
    };
    expect(judgeEvents.events.some((e) => e.id === eventId)).toBe(false);
    const participantEvents = (await (
      await participantAApi.get('/api/participant/events')
    ).json()) as {
      events: Array<{ id: string }>;
    };
    expect(participantEvents.events.some((e) => e.id === eventId)).toBe(false);
    // Delta carries judge 2's E9 score from here on (Judge Count 1)
    expect((await results(adminApi, eventId)).teamTotals).toHaveLength(4);
    for (const path of ['export', 'export-judge-scores', 'export-comments']) {
      expect((await adminApi.get(`/api/admin/results/${path}?eventId=${eventId}`)).status()).toBe(
        200
      );
    }
    const back = await adminApi.put(`/api/admin/events/${eventId}`, {
      data: { name: eventName, status: 'setup' },
    });
    expect((await back.json()).error).toBe('A completed event cannot go back to setup');
    for (const status of ['active', 'open', 'setup'] as const) {
      expect((await setEventStatus(adminApi, eventId, status, eventName, 3)).event.status).toBe(
        status
      );
    }
  });

  test('Phase H — invitation link, old verify URL, sync-users, role guard, reorder stress, status guards', async ({
    browser,
    adminApi,
    superAdminApi,
  }) => {
    const created = await adminApi.post('/api/admin/invitations', {
      data: { emails: [inviteEmail], role: 'judge' },
    });
    expect(created.status()).toBe(201);
    const link = ((await created.json()) as { invitations: Array<{ inviteLink: string }> })
      .invitations[0].inviteLink;
    const token = link.split('/invite/')[1];
    const fresh = await browser.newContext();
    contexts.push(fresh);
    const page = await fresh.newPage();

    // H8: the old verify URL lands on the invitation page; the OTP route is closed
    await page.goto(`/invite/${token}/verify`);
    await expect(page).toHaveURL(new RegExp(`/invite/${token}$`));
    const validate = await fresh.request.post('/api/invite/validate', { data: { token } });
    expect(validate.status()).toBe(404);
    expect((await validate.json()).error_code).toBe('FEATURE_DISABLED');

    await page.goto(link);
    await page.locator('#invite-password').fill('RunbookJudgePass28940!');
    await page.locator('#invite-confirm-password').fill('RunbookJudgePass28940!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL(/\/judge/, { timeout: 60_000 });
    const memberships = (await (await page.request.get('/api/judge/organizations')).json()) as {
      memberships: Array<{ orgName: string }>;
    };
    expect(memberships.memberships.map((m) => m.orgName)).toContain(E2E_ORGANIZATION.name);
    const reuse = await fresh.newPage();
    await reuse.goto(link);
    await expect(reuse.getByText('This invitation has already been used')).toBeVisible();

    const sync = await adminApi.post('/api/admin/sync-users');
    expect(sync.status()).toBe(200);
    const body = (await sync.json()) as { results: Array<{ action: string }> };
    expect(body.results.every((r) => r.action === 'exists' || r.action === 'created')).toBe(true);

    // H6: the admin cannot change the super admin's role; the super admin still logs in
    const superAdmin = await findAuthUserByEmail(ACCOUNTS.superAdmin.email);
    expect(superAdmin).not.toBeNull();
    const guard = await adminApi.put(`/api/admin/users/${superAdmin!.id}/role`, {
      data: { role: 'judge' },
    });
    expect([guard.status(), (await guard.json()).error_code]).toEqual([403, 'FORBIDDEN']);
    const sa = await contextFor(browser, 'superAdmin');
    contexts.push(sa);
    const saPage = await sa.newPage();
    await saPage.goto('/super-admin');
    await expect(saPage.getByRole('tab', { name: 'Organizations' })).toBeVisible();

    // H7: 20 reorders alternating the four teams' order, every one 200, final order as sent
    const order = [ids.alpha, ids.beta, ids.gamma, ids.delta];
    let sent = order;
    for (let call = 0; call < 20; call++) {
      sent = call % 2 === 0 ? [...order].reverse() : order;
      const response = await adminApi.post('/api/admin/teams/reorder', {
        data: {
          eventId,
          teamOrders: sent.map((id, index) => ({ id, presentationOrder: index + 1 })),
        },
      });
      expect(response.status(), `call ${call + 1}: ${await response.text()}`).toBe(200);
    }
    const listed = (await (await adminApi.get(`/api/admin/teams?eventId=${eventId}`)).json()) as {
      teams: Array<{ id: string }>;
    };
    expect(listed.teams.map((t) => t.id)).toEqual(sent);

    // H10: while active, the API refuses a team delete and every criteria write; nothing changes
    await setEventStatus(adminApi, eventId, 'active', eventName);
    const before = await results(adminApi, eventId);
    const teamDelete = await adminApi.delete(`/api/admin/teams/${ids.alpha}`);
    expect([teamDelete.status(), (await teamDelete.json()).error]).toEqual([
      400,
      'Teams can only be deleted while the event is in setup or open',
    ]);
    const criterionPut = await adminApi.put(`/api/admin/criteria/${ids.C1}`, {
      data: {
        name: 'QA-Renamed',
        category: 'technical',
        weight: 40,
        minScore: 1,
        maxScore: 10,
        displayOrder: 1,
      },
    });
    expect([criterionPut.status(), (await criterionPut.json()).error]).toEqual([
      400,
      'Criteria cannot be changed once judging has started',
    ]);
    const criterionDelete = await adminApi.delete(`/api/admin/criteria/${ids.C1}`);
    expect([criterionDelete.status(), (await criterionDelete.json()).error_code]).toEqual([
      400,
      'INVALID_STATUS',
    ]);
    const teamsNow = (await (await adminApi.get(`/api/admin/teams?eventId=${eventId}`)).json()) as {
      teams: Array<{ id: string }>;
    };
    expect(teamsNow.teams.map((t) => t.id)).toEqual(sent);
    const criteriaNow = (await (
      await adminApi.get(`/api/admin/criteria?eventId=${eventId}`)
    ).json()) as { criteria: Array<{ id: string; name: string }> };
    expect(criteriaNow.criteria.find((c) => c.id === ids.C1)?.name).toBe('QA-Tech-Merit');
    expect((await results(adminApi, eventId)).scores).toEqual(before.scores);

    // H11: the super admin cannot delete judge 1, who has scores
    const judgeDelete = await superAdminApi.delete(`/api/super-admin/users/${judgeIds.j1}`);
    expect([judgeDelete.status(), (await judgeDelete.json()).error]).toEqual([
      400,
      'This judge has scores; remove them from the organization instead',
    ]);
    expect(await findAuthUserByEmail(ACCOUNTS.judge1.email)).not.toBeNull();
    expect((await results(adminApi, eventId)).scores).toEqual(before.scores);

    // H12: two admin team creates at once both succeed with the next two orders
    await setEventStatus(adminApi, eventId, 'setup', eventName);
    const [ra, rb] = await Promise.all(
      ['A', 'B'].map((side) =>
        adminApi.post('/api/admin/teams', {
          data: { eventId, name: `QA-Race-${side}`, awardType: 'both' },
        })
      )
    );
    expect([ra.status(), rb.status()], `${await ra.text()} | ${await rb.text()}`).toEqual([
      201, 201,
    ]);
    const [ta, tb] = (await Promise.all([ra.json(), rb.json()])) as Array<{
      team: { id: string; presentationOrder: number };
    }>;
    expect([ta.team.presentationOrder, tb.team.presentationOrder].sort()).toEqual([5, 6]);
    for (const id of [ta.team.id, tb.team.id]) {
      expect((await adminApi.delete(`/api/admin/teams/${id}`)).status()).toBe(200);
    }
  });

  test('§6 — cleanup returns every table to its baseline', async ({ adminApi }) => {
    await deleteEvent(adminApi, eventId, eventName);
    eventId = '';
    await deleteInvitationsFor(inviteEmail);
    await deleteUserByEmail(inviteEmail);
    const after: Record<string, number> = {};
    for (const table of TABLES) after[table] = await countRows(table);
    expect(after).toEqual(baseline);
  });
});
