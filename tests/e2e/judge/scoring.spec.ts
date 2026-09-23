import { test, expect, ACCOUNTS, contextFor } from '../support/fixtures';
import { storageStatePath } from '../support/accounts';
import {
  qaName,
  createEvent,
  deleteEvent,
  setEventStatus,
  addCriterion,
  addTeam,
  assignJudges,
  orgJudges,
  results,
} from '../support/api';
import { expectJudgeLockedOut } from '../support/admin-page';
import type { Page } from '@playwright/test';

/**
 * Judge flow (Phase E): only assigned active events are visible; criteria
 * follow the team's award type; scores auto-save with a check mark; a comment
 * without a score is refused; the sidebar icons reflect completion; the
 * second judge is independent; an `open` event cannot be accessed. The last
 * three cases are the interruptions of a live event: the judge unassigned or
 * the event completed while a team is open, and a save that never reaches
 * the server (H13).
 */
const CRITERIA = [
  { name: 'QA-Tech-Merit', category: 'technical' as const, weight: 40 },
  { name: 'QA-Innovation', category: 'technical' as const, weight: 20 },
  { name: 'QA-Biz-Viability', category: 'business' as const, weight: 30 },
  { name: 'QA-Presentation', category: 'business' as const, weight: 10 },
];

function criterionCard(page: Page, name: string) {
  return page
    .locator('h3', { hasText: name })
    .locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
}

async function scoreCriterion(page: Page, name: string, value: number) {
  const card = criterionCard(page, name);
  await card.getByRole('button', { name: String(value), exact: true }).click();
  // the check icon appears once the debounced save (500 ms) has completed
  await expect(card.locator('svg.text-green-500')).toBeVisible({ timeout: 10_000 });
}

function sidebarRow(page: Page, teamName: string) {
  return page
    .locator('span', { hasText: teamName })
    .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
    .first();
}

async function expectSidebarStatus(
  page: Page,
  teamName: string,
  status: 'completed' | 'partial' | 'not-started'
) {
  const row = sidebarRow(page, teamName);
  const border = {
    completed: /border-green-200/,
    partial: /border-yellow-200/,
    'not-started': /border-border/,
  }[status];
  await expect(row).toHaveClass(border, { timeout: 15_000 });
}

test.describe('Judge scoring @smoke', () => {
  // the steps build on each other: a failure skips the rest instead of rerunning setup
  test.describe.configure({ mode: 'serial' });

  const eventName = qaName('Scoring');
  let eventId: string;
  const ids: Record<string, string> = {};
  const judgeIds: Record<'judge1' | 'judge2', string> = { judge1: '', judge2: '' };

  test.beforeAll(async ({ adminApi }) => {
    eventId = (await createEvent(adminApi, eventName)).id;
    for (const c of CRITERIA) ids[c.name] = (await addCriterion(adminApi, eventId, c)).id;
    ids.alpha = (await addTeam(adminApi, eventId, { name: 'QA-Alpha', awardType: 'technical' })).id;
    ids.beta = (await addTeam(adminApi, eventId, { name: 'QA-Beta', awardType: 'business' })).id;
    ids.gamma = (
      await addTeam(adminApi, eventId, { name: 'QA-Gamma "Quoted", Team', awardType: 'both' })
    ).id;
    ids.delta = (await addTeam(adminApi, eventId, { name: 'QA-Delta', awardType: 'both' })).id;
    const judges = await orgJudges(adminApi, eventId);
    judgeIds.judge1 = judges.find((j) => j.email === ACCOUNTS.judge1.email)!.id;
    judgeIds.judge2 = judges.find((j) => j.email === ACCOUNTS.judge2.email)!.id;
    await assignJudges(adminApi, eventId, [judgeIds.judge1, judgeIds.judge2]);
    await setEventStatus(adminApi, eventId, 'open', eventName);
  });

  test.afterAll(async ({ adminApi }) => {
    await deleteEvent(adminApi, eventId, eventName);
  });

  test('an open event is not accessible to judges', async ({ browser }) => {
    const judge = await contextFor(browser, 'judge1');
    const page = await judge.newPage();
    await page.goto('/judge');
    await expect(page.getByText(eventName)).toHaveCount(0);
    await page.goto(`/judge/event/${eventId}`);
    await expectJudgeLockedOut(page);
    await judge.close();
  });

  test('judge 1 scores the runbook dataset with auto-save, refuses comment-only rows and sees the sidebar icons', async ({
    browser,
    adminApi,
    judge1Api,
  }) => {
    await setEventStatus(adminApi, eventId, 'active', eventName);

    const judge = await contextFor(browser, 'judge1');
    const page = await judge.newPage();
    await page.goto('/judge');
    await expect(page.getByText(eventName)).toBeVisible();
    await page.getByRole('link', { name: new RegExp(eventName) }).click();
    await page.waitForURL(new RegExp(`/judge/event/${eventId}`));

    // E1 sidebar lists the four teams in order, all untouched
    for (const team of ['1. QA-Alpha', '2. QA-Beta', '3. QA-Gamma', '4. QA-Delta']) {
      await expect(page.getByText(team).first()).toBeVisible();
    }
    for (const team of ['QA-Alpha', 'QA-Beta', 'QA-Gamma', 'QA-Delta']) {
      await expectSidebarStatus(page, team, 'not-started');
    }

    // E2 criteria follow the award type
    await sidebarRow(page, 'QA-Alpha').click();
    await page.waitForURL(new RegExp(`/team/${ids.alpha}`));
    await expect(page.locator('h3', { hasText: 'QA-Tech-Merit' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'QA-Innovation' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'QA-Biz-Viability' })).toHaveCount(0);
    await expect(page.locator('h3', { hasText: 'QA-Presentation' })).toHaveCount(0);

    // E3 judge 1's scores for Alpha
    await scoreCriterion(page, 'QA-Tech-Merit', 8);
    await scoreCriterion(page, 'QA-Innovation', 6);
    await expect(page.getByText('Progress: 2 of 2 criteria scored')).toBeVisible();
    await expectSidebarStatus(page, 'QA-Alpha', 'completed');

    // Beta: business criteria only
    await sidebarRow(page, 'QA-Beta').click();
    await page.waitForURL(new RegExp(`/team/${ids.beta}`));
    await expect(page.locator('h3', { hasText: 'QA-Tech-Merit' })).toHaveCount(0);
    await scoreCriterion(page, 'QA-Biz-Viability', 9);
    await scoreCriterion(page, 'QA-Presentation', 7);
    await expectSidebarStatus(page, 'QA-Beta', 'completed');

    // Gamma: all four; E4 a comment without a score is refused
    await sidebarRow(page, 'QA-Gamma').click();
    await page.waitForURL(new RegExp(`/team/${ids.gamma}`));
    await expect(page.locator('h3', { hasText: 'QA-Presentation' })).toBeVisible();
    await criterionCard(page, 'QA-Presentation').locator('textarea').fill('Comment before score');
    await expect(page.getByText('Please set a score before adding comments')).toBeVisible();
    await page.waitForTimeout(800);
    const saved = (await (
      await judge1Api.get(`/api/judge/scores?teamId=${ids.gamma}&eventId=${eventId}`)
    ).json()) as {
      scores: Array<{ criterionId: string }>;
    };
    expect(saved.scores.some((s) => s.criterionId === ids['QA-Presentation'])).toBe(false);

    await scoreCriterion(page, 'QA-Tech-Merit', 10);
    await scoreCriterion(page, 'QA-Innovation', 8);
    await scoreCriterion(page, 'QA-Biz-Viability', 6);
    await expectSidebarStatus(page, 'QA-Gamma', 'partial');
    await scoreCriterion(page, 'QA-Presentation', 4);
    await expect(page.getByText('Progress: 4 of 4 criteria scored')).toBeVisible();
    await expectSidebarStatus(page, 'QA-Gamma', 'completed');
    await expectSidebarStatus(page, 'QA-Delta', 'not-started');

    // the comment is stored with the score
    const gamma = (await (
      await judge1Api.get(`/api/judge/scores?teamId=${ids.gamma}&eventId=${eventId}`)
    ).json()) as {
      scores: Array<{ criterionId: string; score: number; comment: string | null }>;
    };
    expect(gamma.scores.find((s) => s.criterionId === ids['QA-Presentation'])).toMatchObject({
      score: 4,
      comment: 'Comment before score',
    });

    // E5 the API refuses 5.5, a non-applicable criterion and an out-of-range score
    const half = await judge1Api.post('/api/judge/scores', {
      data: { eventId, teamId: ids.alpha, criterionId: ids['QA-Tech-Merit'], score: 5.5 },
    });
    expect(half.status()).toBe(400);
    expect((await half.json()).error_code).toBe('INVALID_SCORE');
    const business = await judge1Api.post('/api/judge/scores', {
      data: { eventId, teamId: ids.alpha, criterionId: ids['QA-Biz-Viability'], score: 5 },
    });
    expect(business.status()).toBe(400);
    expect((await business.json()).error_code).toBe('CRITERION_NOT_APPLICABLE');
    const eleven = await judge1Api.post('/api/judge/scores', {
      data: { eventId, teamId: ids.alpha, criterionId: ids['QA-Tech-Merit'], score: 11 },
    });
    expect(eleven.status()).toBe(400);
    expect((await eleven.json()).error).toBe('Score must be between 1 and 10');

    await judge.close();
  });

  test('judge 2 scores independently and sees their own icons', async ({ browser, judge1Api }) => {
    const judge = await contextFor(browser, 'judge2');
    const page = await judge.newPage();
    await page.goto(`/judge/event/${eventId}/team/${ids.alpha}`);
    for (const team of ['QA-Alpha', 'QA-Beta', 'QA-Gamma', 'QA-Delta']) {
      await expectSidebarStatus(page, team, 'not-started');
    }
    // judge 1's selection is not shown to judge 2
    await expect(
      criterionCard(page, 'QA-Tech-Merit').getByRole('button', { name: '8', exact: true })
    ).not.toHaveClass(/ring-2/);

    await scoreCriterion(page, 'QA-Tech-Merit', 7);
    await scoreCriterion(page, 'QA-Innovation', 9);
    await sidebarRow(page, 'QA-Beta').click();
    await scoreCriterion(page, 'QA-Biz-Viability', 5);
    await scoreCriterion(page, 'QA-Presentation', 10);
    await sidebarRow(page, 'QA-Gamma').click();
    await scoreCriterion(page, 'QA-Tech-Merit', 6);
    await scoreCriterion(page, 'QA-Innovation', 6);
    await expectSidebarStatus(page, 'QA-Alpha', 'completed');
    await expectSidebarStatus(page, 'QA-Beta', 'completed');
    await expectSidebarStatus(page, 'QA-Gamma', 'partial');
    await expectSidebarStatus(page, 'QA-Delta', 'not-started');

    // judge 1's Alpha scores are untouched
    const alpha = (await (
      await judge1Api.get(`/api/judge/scores?teamId=${ids.alpha}&eventId=${eventId}`)
    ).json()) as {
      scores: Array<{ criterionId: string; score: number }>;
    };
    expect(alpha.scores.find((s) => s.criterionId === ids['QA-Tech-Merit'])?.score).toBe(8);
    await judge.close();
  });

  test('a judge changes a score (upsert) and setting the event back to open locks everyone out', async ({
    browser,
    adminApi,
    judge1Api,
  }) => {
    const judge = await contextFor(browser, 'judge1');
    const page = await judge.newPage();
    await page.goto(`/judge/event/${eventId}/team/${ids.alpha}`);
    await expect(
      criterionCard(page, 'QA-Tech-Merit').getByRole('button', { name: '8', exact: true })
    ).toHaveClass(/ring-2/);
    await scoreCriterion(page, 'QA-Tech-Merit', 10);
    const alpha = (await (
      await judge1Api.get(`/api/judge/scores?teamId=${ids.alpha}&eventId=${eventId}`)
    ).json()) as {
      scores: Array<{ criterionId: string; score: number }>;
    };
    expect(alpha.scores).toHaveLength(2);
    expect(alpha.scores.find((s) => s.criterionId === ids['QA-Tech-Merit'])?.score).toBe(10);

    // E8
    await setEventStatus(adminApi, eventId, 'open', eventName);
    await page.goto(`/judge/event/${eventId}`);
    await expectJudgeLockedOut(page);
    await setEventStatus(adminApi, eventId, 'active', eventName);
    await page.goto(`/judge/event/${eventId}/team/${ids.alpha}`);
    await expect(
      criterionCard(page, 'QA-Tech-Merit').getByRole('button', { name: '10', exact: true })
    ).toHaveClass(/ring-2/);
    await judge.close();
  });

  test('E9: a score chosen just before leaving the page is still saved', async ({
    browser,
    judge2Api,
  }) => {
    const judge = await contextFor(browser, 'judge2');
    const page = await judge.newPage();
    const deltaScores = async () => {
      const body = (await (
        await judge2Api.get(`/api/judge/scores?teamId=${ids.delta}&eventId=${eventId}`)
      ).json()) as { scores: Array<{ criterionId: string; score: number }> };
      return Object.fromEntries(body.scores.map((s) => [s.criterionId, s.score]));
    };

    // (a) leave the page within the 500 ms debounce: a full navigation
    await page.goto(`/judge/event/${eventId}/team/${ids.delta}`);
    await expect(page.locator('h3', { hasText: 'QA-Tech-Merit' })).toBeVisible();
    await criterionCard(page, 'QA-Tech-Merit')
      .getByRole('button', { name: '7', exact: true })
      .click();
    await page.goto('/judge');
    await expect.poll(async () => (await deltaScores())[ids['QA-Tech-Merit']]).toBe(7);

    // (b) switch team within the debounce: the save reaches the old team, the new team starts fresh
    await page.goto(`/judge/event/${eventId}/team/${ids.delta}`);
    await expect(page.locator('h3', { hasText: 'QA-Innovation' })).toBeVisible();
    await criterionCard(page, 'QA-Innovation')
      .getByRole('button', { name: '5', exact: true })
      .click();
    await sidebarRow(page, 'QA-Alpha').click();
    await page.waitForURL(new RegExp(`/team/${ids.alpha}`));
    await expect.poll(async () => (await deltaScores())[ids['QA-Innovation']]).toBe(5);
    // Alpha shows judge 2's own earlier scores, untouched by Delta's save
    await expect(
      criterionCard(page, 'QA-Tech-Merit').getByRole('button', { name: '7', exact: true })
    ).toHaveClass(/ring-2/);
    await expect(page.getByText('Progress: 2 of 2 criteria scored')).toBeVisible();
    await judge.close();
  });

  test('H2: at 375 px the team list sits behind the menu, scoring works and dark mode switches', async ({
    browser,
  }) => {
    const judge = await browser.newContext({
      storageState: storageStatePath('judge2'),
      viewport: { width: 375, height: 812 },
    });
    const page = await judge.newPage();
    await page.goto(`/judge/event/${eventId}/team/${ids.beta}`);
    await expect(page.locator('h3', { hasText: 'QA-Biz-Viability' })).toBeVisible();

    // the sidebar is closed; the menu button opens it as a sheet and a team can be picked
    const sheet = page.getByRole('dialog', { name: 'Teams Navigation' });
    await expect(sheet).toBeHidden();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(sheet).toBeVisible();
    await sheet.getByText('QA-Gamma').click();
    await page.waitForURL(new RegExp(`/team/${ids.gamma}`));

    // scoring works at phone width (judge 2 had left Gamma's C3 unscored)
    await scoreCriterion(page, 'QA-Biz-Viability', 7);

    // dark mode
    await page.getByRole('button', { name: 'Change theme' }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await judge.close();
  });

  test('H9: an expired session says so instead of showing an empty list', async ({ browser }) => {
    const judge = await contextFor(browser, 'judge1');
    const page = await judge.newPage();
    await page.goto(`/judge/event/${eventId}/team/${ids.beta}`);
    await expect(page.locator('h3', { hasText: 'QA-Biz-Viability' })).toBeVisible();

    await judge.clearCookies();
    // an in-page API call (a save) reports the expired session; the API answers JSON, not HTML
    const probe = await page.evaluate(() =>
      fetch('/api/judge/teams').then((r) => [r.redirected, r.status] as const)
    );
    expect(probe).toEqual([false, 401]);
    await criterionCard(page, 'QA-Biz-Viability')
      .getByRole('button', { name: '8', exact: true })
      .click();
    await expect(page.getByText('Your session has expired')).toBeVisible({ timeout: 10_000 });

    // the next navigation lands on the login page
    await sidebarRow(page, 'QA-Alpha').click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await judge.close();
  });

  test('a judge unassigned while a team is open gets a toast, loses nothing and can save once re-assigned', async ({
    browser,
    adminApi,
    judge1Api,
  }) => {
    const judge = await contextFor(browser, 'judge1');
    const page = await judge.newPage();
    await page.goto(`/judge/event/${eventId}/team/${ids.delta}`);
    await expect(page.locator('h3', { hasText: 'QA-Tech-Merit' })).toBeVisible();

    // the admin unassigns judge 1 while the page is open (judge 2 stays)
    await assignJudges(adminApi, eventId, [judgeIds.judge2]);
    const card = criterionCard(page, 'QA-Tech-Merit');
    await card.getByRole('button', { name: '7', exact: true }).click();
    // with no active assignment left the route answers 400 NO_ACTIVE_EVENT; the
    // page shows the error state and stays where it is
    await expect(page.getByText('No active event')).toBeVisible({ timeout: 10_000 });
    await expect(card.locator('svg.text-red-500')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/team/${ids.delta}`));
    await expect(page.locator('h3', { hasText: 'QA-Tech-Merit' })).toBeVisible();

    // re-assigned: nothing was written by the refused click, and the same click saves
    await assignJudges(adminApi, eventId, [judgeIds.judge1, judgeIds.judge2]);
    const deltaScores = async () => {
      const body = (await (
        await judge1Api.get(`/api/judge/scores?teamId=${ids.delta}&eventId=${eventId}`)
      ).json()) as { scores: Array<{ criterionId: string; score: number }> };
      return Object.fromEntries(body.scores.map((s) => [s.criterionId, s.score]));
    };
    expect((await deltaScores())[ids['QA-Tech-Merit']]).toBeUndefined();
    await scoreCriterion(page, 'QA-Tech-Merit', 7);
    expect((await deltaScores())[ids['QA-Tech-Merit']]).toBe(7);
    await judge.close();
  });

  test('the event completed while a team is open: the next click is refused, nothing saved is lost, active again saves', async ({
    browser,
    adminApi,
    judge1Api,
  }) => {
    const judge = await contextFor(browser, 'judge1');
    const page = await judge.newPage();
    await page.goto(`/judge/event/${eventId}/team/${ids.delta}`);
    await expect(page.locator('h3', { hasText: 'QA-Innovation' })).toBeVisible();

    await setEventStatus(adminApi, eventId, 'completed', eventName);
    const card = criterionCard(page, 'QA-Innovation');
    await card.getByRole('button', { name: '5', exact: true }).click();
    await expect(page.getByText('No active event')).toBeVisible({ timeout: 10_000 });
    await expect(card.locator('svg.text-red-500')).toBeVisible();

    // judge 1's Delta C1 = 7 from the previous case is still counted; C2 was not written
    const counted = (await results(adminApi, eventId)).scores.filter(
      (s) => s.team.id === ids.delta && s.judge.id === judgeIds.judge1
    );
    expect(counted.map((s) => [s.criterion.id, s.score])).toEqual([[ids['QA-Tech-Merit'], 7]]);

    // active again: the same click saves without a reload
    await setEventStatus(adminApi, eventId, 'active', eventName);
    await scoreCriterion(page, 'QA-Innovation', 5);
    const saved = (await (
      await judge1Api.get(`/api/judge/scores?teamId=${ids.delta}&eventId=${eventId}`)
    ).json()) as { scores: Array<{ criterionId: string; score: number }> };
    expect(saved.scores.find((s) => s.criterionId === ids['QA-Innovation'])?.score).toBe(5);
    await judge.close();
  });

  test('H13: a save that never reaches the server shows the error state; the same click saves once the network is back', async ({
    browser,
    judge1Api,
  }) => {
    const judge = await contextFor(browser, 'judge1');
    const page = await judge.newPage();
    await page.goto(`/judge/event/${eventId}/team/${ids.delta}`);
    await expect(page.locator('h3', { hasText: 'QA-Biz-Viability' })).toBeVisible();

    // the venue Wi-Fi drops for one request
    await page.route('**/api/judge/scores', (route) => route.abort());
    const card = criterionCard(page, 'QA-Biz-Viability');
    await card.getByRole('button', { name: '6', exact: true }).click();
    await expect(page.getByText('Could not reach the server')).toBeVisible({ timeout: 10_000 });
    await expect(card.locator('svg.text-red-500')).toBeVisible();
    const before = (await (
      await judge1Api.get(`/api/judge/scores?teamId=${ids.delta}&eventId=${eventId}`)
    ).json()) as { scores: Array<{ criterionId: string; score: number }> };
    expect(before.scores.some((s) => s.criterionId === ids['QA-Biz-Viability'])).toBe(false);

    // the network is back: the same click saves because the failed value was never marked saved
    await page.unroute('**/api/judge/scores');
    await scoreCriterion(page, 'QA-Biz-Viability', 6);
    const after = (await (
      await judge1Api.get(`/api/judge/scores?teamId=${ids.delta}&eventId=${eventId}`)
    ).json()) as { scores: Array<{ criterionId: string; score: number }> };
    expect(after.scores.find((s) => s.criterionId === ids['QA-Biz-Viability'])?.score).toBe(6);
    await judge.close();
  });
});
