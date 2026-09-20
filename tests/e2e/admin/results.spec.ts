import { test, expect, ACCOUNTS } from '../support/fixtures';
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
import { adminContextFor, openAdminTab, chooseOption } from '../support/admin-page';
import { rest } from '../support/supabase-admin';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Results accuracy (Phase F): the runbook §3 dataset entered through the
 * judge API reproduces the §3.1 numbers in all three modes on the Results tab
 * and in both CSV exports; M1–M4 follow; a team name with a quote and a comma
 * exports as one valid field.
 */
const CRITERIA = [
  { key: 'C1', name: 'QA-Tech-Merit', category: 'technical' as const, weight: 40 },
  { key: 'C2', name: 'QA-Innovation', category: 'technical' as const, weight: 20 },
  { key: 'C3', name: 'QA-Biz-Viability', category: 'business' as const, weight: 30 },
  { key: 'C4', name: 'QA-Presentation', category: 'business' as const, weight: 10 },
];
const GAMMA = 'QA-Gamma "Quoted", Team';
const COMMENT = 'Solid "demo", well argued';

type Dataset = Array<[team: string, judge: 'j1' | 'j2' | 'j3', criterion: string, score: number]>;
const S0: Dataset = [
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

function rankingRows(page: Page) {
  return page.locator('table').first().locator('tbody tr');
}

async function readRanking(page: Page) {
  const rows = rankingRows(page);
  const count = await rows.count();
  const out: Array<{ name: string; score: string }> = [];
  for (let i = 0; i < count; i++) {
    const cells = rows.nth(i).locator('td');
    out.push({
      name: (await cells.nth(1).locator('[title]').first().getAttribute('title')) ?? '',
      score: ((await cells.nth(2).innerText()) ?? '').trim(),
    });
  }
  return out;
}

test.describe('Admin results', () => {
  // the steps build on each other: a failure skips the rest instead of rerunning setup
  test.describe.configure({ mode: 'serial' });

  const eventName = qaName('Results');
  let eventId: string;
  const ids: Record<string, string> = {};
  const judgeIds: Record<string, string> = {};
  let judgeApi: Record<'j1' | 'j2' | 'j3', APIRequestContext>;

  async function enter(rows: Dataset) {
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

  test.beforeAll(async ({ adminApi, judge1Api, judge2Api, judge3Api }) => {
    judgeApi = { j1: judge1Api, j2: judge2Api, j3: judge3Api };
    eventId = (await createEvent(adminApi, eventName, { maxTeamSize: 3 })).id;
    for (const c of CRITERIA) ids[c.key] = (await addCriterion(adminApi, eventId, c)).id;
    ids.alpha = (await addTeam(adminApi, eventId, { name: 'QA-Alpha', awardType: 'technical' })).id;
    ids.beta = (await addTeam(adminApi, eventId, { name: 'QA-Beta', awardType: 'business' })).id;
    ids.gamma = (await addTeam(adminApi, eventId, { name: GAMMA, awardType: 'both' })).id;
    ids.delta = (await addTeam(adminApi, eventId, { name: 'QA-Delta', awardType: 'both' })).id;
    for (const judge of await orgJudges(adminApi, eventId)) {
      if (judge.email === ACCOUNTS.judge1.email) judgeIds.j1 = judge.id;
      if (judge.email === ACCOUNTS.judge2.email) judgeIds.j2 = judge.id;
      if (judge.email === ACCOUNTS.judge3.email) judgeIds.j3 = judge.id;
    }
    await assignJudges(adminApi, eventId, [judgeIds.j1, judgeIds.j2]);
    await setEventStatus(adminApi, eventId, 'active', eventName);
    await enter(S0);
    // E4: judge 1's comment on Gamma C1 (saved together with the score), read back by F11
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
  });

  test.afterAll(async ({ adminApi }) => {
    await deleteEvent(adminApi, eventId, eventName);
  });

  test('S0: the API and the Results tab show the §3.1 numbers in all three modes', async ({
    browser,
    adminApi,
  }) => {
    const data = await results(adminApi, eventId);
    const byName = Object.fromEntries(data.teamTotals.map((t) => [t.teamName, t]));
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
    expect(data.scores).toHaveLength(14);
    const averages = Object.fromEntries(
      data.criteriaAverages.map((a) => [`${a.teamId}:${a.criterionId}`, a.averageScore])
    );
    expect(averages[`${ids.alpha}:${ids.C1}`]).toBe(7.5);
    expect(averages[`${ids.beta}:${ids.C4}`]).toBe(8.5);
    expect(averages[`${ids.gamma}:${ids.C4}`]).toBe(4);

    const context = await adminContextFor(browser, eventId);
    const page = await context.newPage();
    await openAdminTab(page, 'Results', eventName);
    await expect(rankingRows(page)).toHaveCount(3);

    // summary cards: 14 / 3 / 2 / 88 %
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

    expect(await readRanking(page)).toEqual([
      { name: GAMMA, score: '40' },
      { name: 'QA-Beta', score: '31' },
      { name: 'QA-Alpha', score: '30' },
    ]);

    // comboboxes on the page: event selector, award-type filter, score mode
    const filterSelect = page.getByRole('combobox').nth(1);
    const modeSelect = page.getByRole('combobox').nth(2);
    await chooseOption(page, modeSelect, /Average Score/);
    expect((await readRanking(page)).map((r) => [r.name, r.score])).toEqual([
      [GAMMA, '20'],
      ['QA-Beta', '15.5'],
      ['QA-Alpha', '15'],
    ]);
    await chooseOption(page, modeSelect, /Weighted Score/);
    expect((await readRanking(page)).map((r) => [r.name, r.score])).toEqual([
      ['QA-Alpha', '7.50'],
      ['QA-Beta', '7.38'],
      [GAMMA, '5.70'],
    ]);

    // F2 award-type filter
    await chooseOption(page, filterSelect, /Technical Only/);
    expect((await readRanking(page)).map((r) => r.name)).toEqual(['QA-Alpha']);
    await chooseOption(page, filterSelect, /Business Only/);
    expect((await readRanking(page)).map((r) => r.name)).toEqual(['QA-Beta']);

    // F4 the export button downloads the CSV for the selected mode
    await chooseOption(page, filterSelect, /All Teams/);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).first().click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(
      /^judging-results-.*-weighted-\d{4}-\d{2}-\d{2}\.csv$/
    );
    await context.close();
  });

  test('both CSV exports parse and match, with Gamma’s name as one escaped field', async ({
    adminApi,
  }) => {
    for (const [mode, expected] of [
      [
        'total',
        [
          [GAMMA, '40'],
          ['QA-Beta', '31'],
          ['QA-Alpha', '30'],
        ],
      ],
      [
        'average',
        [
          [GAMMA, '20'],
          ['QA-Beta', '15.5'],
          ['QA-Alpha', '15'],
        ],
      ],
      [
        'weighted',
        [
          ['QA-Alpha', '7.5'],
          ['QA-Beta', '7.38'],
          [GAMMA, '5.7'],
        ],
      ],
    ] as const) {
      const response = await adminApi.get(
        `/api/admin/results/export?eventId=${eventId}&scoreMode=${mode}`
      );
      expect(response.status()).toBe(200);
      const text = await response.text();
      expect(text).toContain('"QA-Gamma ""Quoted"", Team"');
      const rows = parseCsv(text);
      expect(rows[0]).toEqual([
        'Rank',
        'Tied',
        'Team Name',
        'Award Type',
        'Presentation Order',
        `${mode[0].toUpperCase()}${mode.slice(1)} Score`,
        'Number of Scores',
        'Judge Count',
      ]);
      expect(rows.slice(1).map((r) => [r[2], r[5]])).toEqual(expected.map((e) => [...e]));
      expect(rows.slice(1).map((r) => r[0])).toEqual(['1', '2', '3']);
      // no ties in S0
      expect(rows.slice(1).map((r) => r[1])).toEqual(['', '', '']);
      const gamma = rows.find((r) => r[2] === GAMMA)!;
      expect(gamma).toHaveLength(8);
      expect(gamma[3]).toBe('General');
    }

    const matrix = parseCsv(
      await (await adminApi.get(`/api/admin/results/export-judge-scores?eventId=${eventId}`)).text()
    );
    const j1 = ACCOUNTS.judge1.email.split('@')[0];
    const j2 = ACCOUNTS.judge2.email.split('@')[0];
    expect(matrix[0]).toEqual([
      'Team Name',
      'Presentation Order',
      'Award Type',
      j1,
      j1,
      j1,
      j1,
      j2,
      j2,
      j2,
      j2,
    ]);
    expect(matrix[1].slice(3, 7)).toEqual([
      'QA-Tech-Merit (/10)',
      'QA-Innovation (/10)',
      'QA-Biz-Viability (/10)',
      'QA-Presentation (/10)',
    ]);
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
    expect(matrix[3]).toEqual([
      'QA-Beta',
      '2',
      'Business',
      'N/A',
      'N/A',
      '9',
      '7',
      'N/A',
      'N/A',
      '5',
      '10',
    ]);
    expect(matrix[4]).toEqual([GAMMA, '3', 'General', '10', '8', '6', '4', '6', '6', '', '']);
    expect(matrix[5]).toEqual(['QA-Delta', '4', 'General', '', '', '', '', '', '', '', '']);
  });

  test('M1–M4: score change, third judge assigned and unassigned, award type narrowed', async ({
    adminApi,
  }) => {
    // M1 judge 1 changes Alpha C1 to 10 (upsert)
    await enter([['alpha', 'j1', 'C1', 10]]);
    let data = await results(adminApi, eventId);
    let alpha = data.teamTotals.find((t) => t.teamName === 'QA-Alpha')!;
    expect(alpha).toMatchObject({
      totalScore: 32,
      averageScore: 16,
      weightedScore: 8.17,
      totalScores: 4,
      judgeCount: 2,
    });
    expect(data.scores).toHaveLength(14);
    expect(data.teamTotals.map((t) => t.teamName)).toEqual([GAMMA, 'QA-Alpha', 'QA-Beta']);

    // M2 judge 3 assigned, scores Alpha C1 = 1
    await assignJudges(adminApi, eventId, [judgeIds.j1, judgeIds.j2, judgeIds.j3]);
    await enter([['alpha', 'j3', 'C1', 1]]);
    data = await results(adminApi, eventId);
    alpha = data.teamTotals.find((t) => t.teamName === 'QA-Alpha')!;
    expect(alpha).toMatchObject({
      totalScore: 33,
      averageScore: 11,
      weightedScore: 5.67,
      totalScores: 5,
      judgeCount: 3,
    });
    expect(data.scores).toHaveLength(15);
    expect(
      new Set((data.scores as Array<{ judge: { id: string } }>).map((s) => s.judge.id)).size
    ).toBe(3);
    expect(
      data.criteriaAverages.find((a) => a.teamId === ids.alpha && a.criterionId === ids.C1)
        ?.averageScore
    ).toBe(6);

    // M3 unassign judge 3: back to M1, the row survives, the matrix has no judge 3 columns
    await assignJudges(adminApi, eventId, [judgeIds.j1, judgeIds.j2]);
    data = await results(adminApi, eventId);
    alpha = data.teamTotals.find((t) => t.teamName === 'QA-Alpha')!;
    expect(alpha).toMatchObject({
      totalScore: 32,
      averageScore: 16,
      weightedScore: 8.17,
      judgeCount: 2,
    });
    const matrix = parseCsv(
      await (await adminApi.get(`/api/admin/results/export-judge-scores?eventId=${eventId}`)).text()
    );
    expect(matrix[0]).not.toContain(ACCOUNTS.judge3.email.split('@')[0]);
    const judge3Scores = (await (
      await judgeApi.j3.get(`/api/judge/scores?teamId=${ids.alpha}&eventId=${eventId}`)
    ).json()) as {
      error_code?: string;
    };
    expect(['NOT_ASSIGNED', 'NO_ACTIVE_EVENT']).toContain(judge3Scores.error_code);
    await assignJudges(adminApi, eventId, [judgeIds.j1, judgeIds.j2, judgeIds.j3]);
    expect(
      (await results(adminApi, eventId)).teamTotals.find((t) => t.teamName === 'QA-Alpha')
        ?.totalScore
    ).toBe(33);
    await assignJudges(adminApi, eventId, [judgeIds.j1, judgeIds.j2]);

    // M4 Gamma narrowed to Technical: C1 and C2 only, W = 60
    const narrow = await adminApi.put(`/api/admin/teams/${ids.gamma}`, {
      data: { name: GAMMA, presentationOrder: 3, awardType: 'technical' },
    });
    expect(narrow.status()).toBe(200);
    data = await results(adminApi, eventId);
    const gamma = data.teamTotals.find((t) => t.teamName === GAMMA)!;
    expect(gamma).toMatchObject({
      totalScore: 30,
      averageScore: 15,
      weightedScore: 7.67,
      totalScores: 4,
      judgeCount: 2,
    });
    const completion = (await (
      await judgeApi.j1.get(`/api/judge/completion?eventId=${eventId}`)
    ).json()) as {
      completion: Array<{ teamId: string; completed: boolean }>;
    };
    expect(completion.completion.find((c) => c.teamId === ids.gamma)?.completed).toBe(true);
    const completion2 = (await (
      await judgeApi.j2.get(`/api/judge/completion?eventId=${eventId}`)
    ).json()) as {
      completion: Array<{ teamId: string; completed: boolean }>;
    };
    expect(completion2.completion.find((c) => c.teamId === ids.gamma)?.completed).toBe(true);

    await adminApi.put(`/api/admin/teams/${ids.gamma}`, {
      data: { name: GAMMA, presentationOrder: 3, awardType: 'both' },
    });
    data = await results(adminApi, eventId);
    expect(data.teamTotals.find((t) => t.teamName === GAMMA)).toMatchObject({
      totalScore: 40,
      weightedScore: 5.7,
    });
  });

  test('F10 (M5): equal scores carry a Tie badge on screen and yes in the CSV, in the tied modes only', async ({
    browser,
    adminApi,
  }) => {
    // from M1, judge 1 sets Alpha C1 = 8 and C2 = 7: Alpha 31 / 15.50 / 7.67 ties Beta in Total and Average
    await enter([
      ['alpha', 'j1', 'C1', 8],
      ['alpha', 'j1', 'C2', 7],
    ]);
    const alpha = (await results(adminApi, eventId)).teamTotals.find(
      (t) => t.teamName === 'QA-Alpha'
    );
    expect(alpha).toMatchObject({ totalScore: 31, averageScore: 15.5, weightedScore: 7.67 });

    const tiedRows = [
      [GAMMA, ''],
      ['QA-Alpha', 'yes'],
      ['QA-Beta', 'yes'],
    ];
    for (const [mode, expected] of [
      ['total', tiedRows],
      ['average', tiedRows],
      [
        'weighted',
        [
          ['QA-Alpha', ''],
          ['QA-Beta', ''],
          [GAMMA, ''],
        ],
      ],
    ] as const) {
      const rows = parseCsv(
        await (
          await adminApi.get(`/api/admin/results/export?eventId=${eventId}&scoreMode=${mode}`)
        ).text()
      );
      expect(rows[0].slice(0, 3)).toEqual(['Rank', 'Tied', 'Team Name']);
      expect(rows.slice(1).map((r) => [r[2], r[1]])).toEqual(expected.map((e) => [...e]));
    }

    const context = await adminContextFor(browser, eventId);
    const page = await context.newPage();
    await openAdminTab(page, 'Results', eventName);
    await expect(rankingRows(page)).toHaveCount(3);
    const tieBadge = (row: number) => rankingRows(page).nth(row).getByText('Tie', { exact: true });

    // Total: Gamma 40, then Alpha and Beta at 31 (Alpha first by presentation order), both flagged
    expect(await readRanking(page)).toEqual([
      { name: GAMMA, score: '40' },
      { name: 'QA-Alpha', score: '31' },
      { name: 'QA-Beta', score: '31' },
    ]);
    await expect(tieBadge(0)).toHaveCount(0);
    await expect(tieBadge(1)).toBeVisible();
    await expect(tieBadge(2)).toBeVisible();

    const modeSelect = page.getByRole('combobox').nth(2);
    await chooseOption(page, modeSelect, /Average Score/);
    expect((await readRanking(page)).map((r) => r.score)).toEqual(['20', '15.5', '15.5']);
    await expect(tieBadge(0)).toHaveCount(0);
    await expect(tieBadge(1)).toBeVisible();
    await expect(tieBadge(2)).toBeVisible();

    await chooseOption(page, modeSelect, /Weighted Score/);
    expect((await readRanking(page)).map((r) => [r.name, r.score])).toEqual([
      ['QA-Alpha', '7.67'],
      ['QA-Beta', '7.38'],
      [GAMMA, '5.70'],
    ]);
    await expect(rankingRows(page).getByText('Tie', { exact: true })).toHaveCount(0);
    await context.close();

    // revert to M1
    await enter([
      ['alpha', 'j1', 'C1', 10],
      ['alpha', 'j1', 'C2', 6],
    ]);
    expect(
      (await results(adminApi, eventId)).teamTotals.find((t) => t.teamName === 'QA-Alpha')
    ).toMatchObject({ totalScore: 32, averageScore: 16, weightedScore: 8.17 });
    const total = parseCsv(
      await (await adminApi.get(`/api/admin/results/export?eventId=${eventId}`)).text()
    );
    expect(total.slice(1).map((r) => r[1])).toEqual(['', '', '']);
  });

  test('F11: the comments export lists every counted score with its comment escaped', async ({
    browser,
    adminApi,
  }) => {
    // M1 state: 14 counted rows; judge 3's row exists but is not counted; Delta has none
    const response = await adminApi.get(`/api/admin/results/export-comments?eventId=${eventId}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toMatch(
      /^attachment; filename="judging-comments-.*-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    const text = await response.text();
    expect(text).toContain(',"Solid ""demo"", well argued"');
    const rows = parseCsv(text);
    expect(rows[0]).toEqual([
      'Presentation Order',
      'Team',
      'Award Type',
      'Judge',
      'Criterion',
      'Score',
      'Comment',
    ]);
    expect(rows).toHaveLength(15);
    expect(rows.slice(1).map((r) => r[3])).not.toContain(ACCOUNTS.judge3.email);
    expect(rows.slice(1).map((r) => r[1])).not.toContain('QA-Delta');
    // ordered by presentation order, judge email, criterion display order
    expect(rows.slice(1, 5)).toEqual([
      ['1', 'QA-Alpha', 'Technical', ACCOUNTS.judge1.email, 'QA-Tech-Merit', '10', ''],
      ['1', 'QA-Alpha', 'Technical', ACCOUNTS.judge1.email, 'QA-Innovation', '6', ''],
      ['1', 'QA-Alpha', 'Technical', ACCOUNTS.judge2.email, 'QA-Tech-Merit', '7', ''],
      ['1', 'QA-Alpha', 'Technical', ACCOUNTS.judge2.email, 'QA-Innovation', '9', ''],
    ]);
    expect(rows[9]).toEqual([
      '3',
      GAMMA,
      'General',
      ACCOUNTS.judge1.email,
      'QA-Tech-Merit',
      '10',
      COMMENT,
    ]);
    expect(rows.slice(1).filter((r) => r[6] !== '')).toHaveLength(1);

    // the button next to the matrix export downloads the same file
    const context = await adminContextFor(browser, eventId);
    const page = await context.newPage();
    await openAdminTab(page, 'Results', eventName);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export comments' }).click();
    expect((await download).suggestedFilename()).toMatch(
      /^judging-comments-.*-\d{4}-\d{2}-\d{2}\.csv$/
    );
    await context.close();

    // item 34: a name that would open as a formula is prefixed with a quote in every CSV
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
      expect(parseCsv(csv).flat(), path).toContain("'=QA-Formula");
    }
    expect((await rename('QA-Alpha')).status()).toBe(200);
    expect(
      await (await adminApi.get(`/api/admin/results/export?eventId=${eventId}`)).text()
    ).toContain(',QA-Alpha,');
  });

  test('a score on a non-applicable criterion counts nowhere: completion, results, cards', async ({
    adminApi,
  }) => {
    // a technical team with one applicable score (C1) from judge 2 ...
    ids.epsilon = (
      await addTeam(adminApi, eventId, { name: 'QA-Epsilon', awardType: 'technical' })
    ).id;
    await enter([['epsilon', 'j2', 'C1', 5]]);
    // ... and one business row written straight into the table (the API refuses it)
    await rest('scores', {
      method: 'POST',
      body: {
        event_id: eventId,
        judge_id: judgeIds.j2,
        team_id: ids.epsilon,
        criterion_id: ids.C3,
        score: 5,
      },
      prefer: 'return=minimal',
    });

    // 1 of 2 applicable criteria: not complete (the stray row would make it 2 of 2)
    const completion = (await (
      await judgeApi.j2.get(`/api/judge/completion?eventId=${eventId}`)
    ).json()) as {
      completion: Array<{ teamId: string; completed: boolean; scoredCount?: number }>;
    };
    expect(completion.completion.find((c) => c.teamId === ids.epsilon)?.completed).toBe(false);

    // results and the summary cards see only the applicable row
    const data = await results(adminApi, eventId);
    expect(data.teamTotals.find((t) => t.teamName === 'QA-Epsilon')).toMatchObject({
      totalScore: 5,
      totalScores: 1,
      judgeCount: 1,
    });
    expect(data.scores).toHaveLength(15);
    expect(data.scores.some((s) => s.team.id === ids.epsilon && s.criterion.id === ids.C3)).toBe(
      false
    );
  });

  test('a completed event still serves results and the three exports', async ({ adminApi }) => {
    await setEventStatus(adminApi, eventId, 'completed', eventName);
    expect((await results(adminApi, eventId)).teamTotals).toHaveLength(4);
    expect((await adminApi.get(`/api/admin/results/export?eventId=${eventId}`)).status()).toBe(200);
    expect(
      (await adminApi.get(`/api/admin/results/export-judge-scores?eventId=${eventId}`)).status()
    ).toBe(200);
    expect(
      (await adminApi.get(`/api/admin/results/export-comments?eventId=${eventId}`)).status()
    ).toBe(200);
  });
});
