import { test, expect } from '../support/fixtures';
import { E2E_ORGANIZATION } from '../support/accounts';
import {
  qaName,
  createEvent,
  deleteEvent,
  setEventStatus,
  addCriterion,
  addTeam,
  assignJudges,
  results,
} from '../support/api';
import {
  ensureOrganization,
  ensureUser,
  ensureMembership,
  deleteUserByEmail,
} from '../support/supabase-admin';
import { submitLoginForm } from '../support/login';
import { computeTeamTotals, type CountedScore } from '@/lib/results';
import type { APIRequestContext, BrowserContext } from '@playwright/test';

/**
 * Scoring burst: ten judges, each signed in through the login form, score
 * every criterion of every team at the same time (one request in flight per
 * judge, like real clicking) and the results come out exactly as
 * `lib/results.ts` computes them. It measures the deployed shape, so run it
 * against the production build, not the dev server:
 *
 *   npm run build && npm start
 *   BURST=1 npx playwright test tests/e2e/judge/burst.spec.ts --project=chromium
 *
 * The run prints one summary line (requests, non-200, p50 / p95 / max in ms)
 * and attaches the same numbers to the report.
 */
test.skip(!process.env.BURST, 'set BURST=1 to run the scoring burst');
test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only');

const JUDGES = 10;
const TEAMS = 10;
const PASSWORD = '123456';
const CRITERIA = [
  { name: 'QA-Burst-C1', category: 'technical' as const },
  { name: 'QA-Burst-C2', category: 'technical' as const },
  { name: 'QA-Burst-C3', category: 'business' as const },
  { name: 'QA-Burst-C4', category: 'business' as const },
];
const WEIGHT = 25;

/** The value every judge posts for team `t` (1-based) and criterion `c` (1-based): 1..10. */
function scoreFor(t: number, c: number) {
  return ((t + c) % 10) + 1;
}

function percentile(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

test.describe('Scoring burst', () => {
  const eventName = qaName('Burst');
  const emails = Array.from(
    { length: JUDGES },
    (_, i) => `qa-burst-judge-${String(i + 1).padStart(2, '0')}@test.com`
  );
  const judgeIds: string[] = [];
  const contexts: BrowserContext[] = [];
  const judgeApis: APIRequestContext[] = [];
  let eventId = '';
  const teams: Array<{ id: string; name: string; presentationOrder: number }> = [];
  const criteria: Array<{ id: string; name: string; category: 'technical' | 'business' }> = [];

  test.beforeAll(async ({ browser, adminApi }) => {
    test.setTimeout(600_000);
    const orgId = await ensureOrganization(E2E_ORGANIZATION.name, E2E_ORGANIZATION.slug);
    for (const email of emails) {
      const id = await ensureUser(email, PASSWORD, 'judge');
      await ensureMembership(orgId, id);
      judgeIds.push(id);
    }

    eventId = (await createEvent(adminApi, eventName)).id;
    for (const c of CRITERIA) {
      const created = await addCriterion(adminApi, eventId, { ...c, weight: WEIGHT });
      criteria.push({ ...created, category: c.category });
    }
    for (let t = 1; t <= TEAMS; t++) {
      teams.push(
        await addTeam(adminApi, eventId, {
          name: `QA-Burst-Team-${String(t).padStart(2, '0')}`,
          awardType: 'both',
        })
      );
    }
    await assignJudges(adminApi, eventId, judgeIds);
    await setEventStatus(adminApi, eventId, 'active', eventName);

    // one real login per judge; the request context carries that session
    for (const email of emails) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await submitLoginForm(page, email, PASSWORD);
      await page.waitForURL(/\/judge/, { timeout: 60_000 });
      await page.close();
      judgeApis.push(context.request);
    }
  });

  test.afterAll(async ({ adminApi }) => {
    test.setTimeout(600_000);
    for (const context of contexts) await context.close().catch(() => {});
    if (eventId) await deleteEvent(adminApi, eventId, eventName);
    for (const email of emails) await deleteUserByEmail(email);
  });

  test('ten judges score ten teams on four criteria at once; every save lands and the results add up', async ({
    adminApi,
  }) => {
    test.setTimeout(600_000);
    const samples: Array<{ judge: number; status: number; ms: number }> = [];

    const started = performance.now();
    await Promise.all(
      judgeApis.map(async (api, j) => {
        for (let t = 1; t <= TEAMS; t++) {
          for (let c = 1; c <= CRITERIA.length; c++) {
            const at = performance.now();
            const response = await api.post('/api/judge/scores', {
              data: {
                eventId,
                teamId: teams[t - 1].id,
                criterionId: criteria[c - 1].id,
                score: scoreFor(t, c),
              },
            });
            samples.push({ judge: j + 1, status: response.status(), ms: performance.now() - at });
          }
        }
      })
    );
    const elapsed = performance.now() - started;

    const times = samples.map((s) => s.ms).sort((a, b) => a - b);
    const summary = {
      requests: samples.length,
      non200: samples.filter((s) => s.status !== 200).length,
      p50: Math.round(percentile(times, 50)),
      p95: Math.round(percentile(times, 95)),
      max: Math.round(times[times.length - 1]),
      elapsedMs: Math.round(elapsed),
    };
    console.log(
      `burst: ${summary.requests} requests, ${summary.non200} non-200, p50 ${summary.p50} ms, p95 ${summary.p95} ms, max ${summary.max} ms, ${summary.elapsedMs} ms wall`
    );
    await test.info().attach('burst-summary', {
      body: JSON.stringify({ ...summary, samples }, null, 2),
      contentType: 'application/json',
    });

    expect(samples).toHaveLength(JUDGES * TEAMS * CRITERIA.length);
    expect(
      samples.filter((s) => s.status !== 200),
      'every save answers 200'
    ).toEqual([]);
    expect(summary.p95, 'p95 under 2,000 ms').toBeLessThan(2000);

    // every team: ten judges, forty rows, and the three modes as lib/results.ts computes them
    const counted: CountedScore[] = [];
    for (const judgeId of judgeIds) {
      for (let t = 1; t <= TEAMS; t++) {
        for (let c = 1; c <= CRITERIA.length; c++) {
          counted.push({
            score: scoreFor(t, c),
            team: { ...teams[t - 1], awardType: 'both' },
            criterion: { ...criteria[c - 1], displayOrder: c },
            judge: { id: judgeId },
          });
        }
      }
    }
    const expected = computeTeamTotals(
      counted,
      criteria.map((c) => ({ id: c.id, category: c.category, weight: WEIGHT }))
    );
    const actual = (await results(adminApi, eventId)).teamTotals;
    expect(actual).toHaveLength(TEAMS);
    for (const team of teams) {
      const t = teams.indexOf(team) + 1;
      const sum = CRITERIA.map((_, i) => scoreFor(t, i + 1)).reduce((a, b) => a + b, 0);
      const row = actual.find((r) => r.teamId === team.id)!;
      const want = expected.find((r) => r.teamId === team.id)!;
      expect(row, team.name).toMatchObject({
        judgeCount: JUDGES,
        totalScores: JUDGES * CRITERIA.length,
        totalScore: JUDGES * sum,
        averageScore: want.averageScore,
        weightedScore: want.weightedScore,
      });
      expect(want.totalScore).toBe(JUDGES * sum);
    }
  });
});
