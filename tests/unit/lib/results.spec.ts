import { describe, it, expect } from 'vitest';
import {
  applicableCriteria,
  criterionApplies,
  computeCriteriaAverages,
  computeTeamTotals,
  formatAwardType,
  rankTeamTotals,
  roundRational,
  scoreForMode,
  sortTeamTotals,
  type CountedScore,
} from '@/lib/results';
import type { AwardType, CriteriaCategory, TeamTotal } from '@/lib/types';
import { CRITERIA, TEAMS, SCORES } from '@/tests/unit/test-utils/results-fixture';

/**
 * The QA dataset from documents/2026/4-VERIFICATION-RUNBOOK.md Part II §3
 * (state S0, shared with the route specs through the fixture) and its
 * modifications M1–M5. Every expected number below is the one printed there.
 */
function row(
  team: CountedScore['team'],
  judge: string,
  criterionId: string,
  score: number
): CountedScore {
  const criterion = CRITERIA.find((c) => c.id === criterionId)!;
  return { score, team, criterion, judge: { id: judge } };
}

function dataset(): CountedScore[] {
  return [...SCORES];
}

function byTeam(totals: TeamTotal[]) {
  return Object.fromEntries(totals.map((t) => [t.teamId, t]));
}

function ranking(totals: TeamTotal[], mode: 'total' | 'average' | 'weighted') {
  return sortTeamTotals(totals, mode).map((t) => t.teamId);
}

describe('criterionApplies / applicableCriteria', () => {
  it('matches the category to the award type and lets General teams count everything', () => {
    const cases: Array<[AwardType, CriteriaCategory, boolean]> = [
      ['technical', 'technical', true],
      ['technical', 'business', false],
      ['business', 'business', true],
      ['business', 'technical', false],
      ['both', 'technical', true],
      ['both', 'business', true],
    ];
    for (const [awardType, category, expected] of cases) {
      expect(criterionApplies(awardType, category)).toBe(expected);
    }
    expect(applicableCriteria('technical', CRITERIA).map((c) => c.id)).toEqual(['C1', 'C2']);
    expect(applicableCriteria('business', CRITERIA).map((c) => c.id)).toEqual(['C3', 'C4']);
    expect(applicableCriteria('both', CRITERIA)).toHaveLength(4);
  });
});

describe('roundRational', () => {
  it('rounds half away from zero on the exact fraction', () => {
    expect(roundRational(7375, 1000)).toBe(7.38);
    expect(roundRational(900, 120)).toBe(7.5);
    expect(roundRational(980, 120)).toBe(8.17);
    expect(roundRational(1020, 180)).toBe(5.67);
    expect(roundRational(1, 3)).toBe(0.33);
    expect(roundRational(2, 3)).toBe(0.67);
    expect(roundRational(1005, 1000)).toBe(1.01);
    expect(roundRational(-7375, 1000)).toBe(-7.38);
    expect(roundRational(0, 5)).toBe(0);
  });

  it('rejects non-integers and a zero denominator', () => {
    expect(() => roundRational(1.5, 2)).toThrow(RangeError);
    expect(() => roundRational(1, 0)).toThrow(RangeError);
  });
});

describe('computeTeamTotals — runbook state S0', () => {
  const totals = computeTeamTotals(dataset(), CRITERIA);
  const teams = byTeam(totals);

  it('produces the §3.1 totals, averages, weighted scores and counts', () => {
    expect(teams.alpha).toMatchObject({
      teamName: 'QA-Alpha',
      awardType: 'technical',
      totalScore: 30,
      averageScore: 15,
      weightedScore: 7.5,
      totalScores: 4,
      judgeCount: 2,
    });
    expect(teams.beta).toMatchObject({
      totalScore: 31,
      averageScore: 15.5,
      weightedScore: 7.38,
      totalScores: 4,
      judgeCount: 2,
    });
    expect(teams.gamma).toMatchObject({
      totalScore: 40,
      averageScore: 20,
      weightedScore: 5.7,
      totalScores: 6,
      judgeCount: 2,
    });
  });

  it('leaves a team with no counted score out of the rankings', () => {
    expect(teams.delta).toBeUndefined();
    expect(totals).toHaveLength(3);
  });

  it('ranks Total → Gamma, Beta, Alpha; Average the same; Weighted → Alpha, Beta, Gamma', () => {
    expect(totals.map((t) => t.teamId)).toEqual(['gamma', 'beta', 'alpha']);
    expect(ranking(totals, 'total')).toEqual(['gamma', 'beta', 'alpha']);
    expect(ranking(totals, 'average')).toEqual(['gamma', 'beta', 'alpha']);
    expect(ranking(totals, 'weighted')).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('gives the summary-card inputs: 14 counted rows, 3 teams, 88 % completion', () => {
    const totalScores = totals.reduce((sum, t) => sum + t.totalScores, 0);
    const expected = totals.reduce(
      (sum, t) => sum + applicableCriteria(t.awardType, CRITERIA).length * t.judgeCount,
      0
    );
    expect(totalScores).toBe(14);
    expect(expected).toBe(16);
    expect(Math.round((totalScores / expected) * 100)).toBe(88);
  });
});

describe('computeCriteriaAverages — runbook state S0', () => {
  it('averages every counted (team, criterion) pair in presentation and display order', () => {
    const averages = computeCriteriaAverages(CRITERIA, dataset());
    expect(averages.map((a) => [a.teamId, a.criterionId, a.averageScore, a.judgeCount])).toEqual([
      ['alpha', 'C1', 7.5, 2],
      ['alpha', 'C2', 7.5, 2],
      ['beta', 'C3', 7, 2],
      ['beta', 'C4', 8.5, 2],
      ['gamma', 'C1', 8, 2],
      ['gamma', 'C2', 7, 2],
      ['gamma', 'C3', 6, 1],
      ['gamma', 'C4', 4, 1],
    ]);
    expect(averages[0]).toMatchObject({ teamName: 'QA-Alpha', criterionName: 'QA-Tech-Merit' });
  });
});

describe('computeTeamTotals — modifications', () => {
  function m1(): CountedScore[] {
    // judge 1 changes QA-Alpha C1 from 8 to 10 (an upsert, so the row is replaced)
    return dataset().map((r) =>
      r.team.id === 'alpha' && r.judge.id === 'j1' && r.criterion.id === 'C1'
        ? { ...r, score: 10 }
        : r
    );
  }

  it('M1: Alpha becomes 32 / 16.00 / 8.17 and moves to second in Total and Average', () => {
    const totals = computeTeamTotals(m1(), CRITERIA);
    expect(byTeam(totals).alpha).toMatchObject({
      totalScore: 32,
      averageScore: 16,
      weightedScore: 8.17,
      totalScores: 4,
      judgeCount: 2,
    });
    expect(byTeam(totals).beta).toMatchObject({ totalScore: 31, weightedScore: 7.38 });
    expect(byTeam(totals).gamma).toMatchObject({ totalScore: 40, weightedScore: 5.7 });
    expect(ranking(totals, 'total')).toEqual(['gamma', 'alpha', 'beta']);
    expect(ranking(totals, 'average')).toEqual(['gamma', 'alpha', 'beta']);
    expect(ranking(totals, 'weighted')).toEqual(['alpha', 'beta', 'gamma']);
    const alphaC1 = computeCriteriaAverages(CRITERIA, m1()).find(
      (a) => a.teamId === 'alpha' && a.criterionId === 'C1'
    );
    expect(alphaC1?.averageScore).toBe(8.5);
  });

  it('M2: a third judge scoring one Alpha criterion changes only Alpha', () => {
    const scores = [...m1(), row(TEAMS.alpha, 'j3', 'C1', 1)];
    const totals = computeTeamTotals(scores, CRITERIA);
    expect(byTeam(totals).alpha).toMatchObject({
      totalScore: 33,
      averageScore: 11,
      weightedScore: 5.67,
      totalScores: 5,
      judgeCount: 3,
    });
    expect(byTeam(totals).beta).toMatchObject({ totalScore: 31, averageScore: 15.5 });
    expect(byTeam(totals).gamma).toMatchObject({ totalScore: 40, averageScore: 20 });
    expect(ranking(totals, 'total')).toEqual(['gamma', 'alpha', 'beta']);
    expect(ranking(totals, 'average')).toEqual(['gamma', 'beta', 'alpha']);
    expect(ranking(totals, 'weighted')).toEqual(['beta', 'gamma', 'alpha']);
    const alphaC1 = computeCriteriaAverages(CRITERIA, scores).find(
      (a) => a.teamId === 'alpha' && a.criterionId === 'C1'
    );
    expect(alphaC1).toMatchObject({ averageScore: 6, judgeCount: 3 });
    expect(new Set(scores.map((s) => s.judge.id)).size).toBe(3);
  });

  it('M3: dropping the third judge’s rows restores the M1 numbers', () => {
    const totals = computeTeamTotals(
      [...m1(), row(TEAMS.alpha, 'j3', 'C1', 1)].filter((r) => r.judge.id !== 'j3'),
      CRITERIA
    );
    expect(totals).toEqual(computeTeamTotals(m1(), CRITERIA));
  });

  it('M5: judge 1 sets Alpha C1 = 8 and C2 = 7 → Alpha ties Beta in Total and Average only', () => {
    const scores = m1().map((r) =>
      r.team.id === 'alpha' && r.judge.id === 'j1'
        ? { ...r, score: r.criterion.id === 'C1' ? 8 : 7 }
        : r
    );
    const totals = computeTeamTotals(scores, CRITERIA);
    expect(byTeam(totals).alpha).toMatchObject({
      totalScore: 31,
      averageScore: 15.5,
      weightedScore: 7.67,
      totalScores: 4,
      judgeCount: 2,
    });
    expect(byTeam(totals).beta).toMatchObject({ totalScore: 31, averageScore: 15.5 });

    const flags = (mode: 'total' | 'average' | 'weighted') =>
      rankTeamTotals(totals, mode).map((t) => [t.rank, t.teamId, t.tied]);
    // Alpha before Beta: equal Total, so presentation order decides
    expect(flags('total')).toEqual([
      [1, 'gamma', false],
      [2, 'alpha', true],
      [3, 'beta', true],
    ]);
    expect(flags('average')).toEqual([
      [1, 'gamma', false],
      [2, 'alpha', true],
      [3, 'beta', true],
    ]);
    expect(flags('weighted')).toEqual([
      [1, 'alpha', false],
      [2, 'beta', false],
      [3, 'gamma', false],
    ]);

    // reverting to M1 clears the flags
    expect(rankTeamTotals(computeTeamTotals(m1(), CRITERIA), 'total').some((t) => t.tied)).toBe(
      false
    );
  });

  it('M4: narrowing Gamma to Technical counts C1 and C2 only (W = 60)', () => {
    const gammaTechnical = { ...TEAMS.gamma, awardType: 'technical' as const };
    const scores = m1().map((r) => (r.team.id === 'gamma' ? { ...r, team: gammaTechnical } : r));
    const gamma = byTeam(computeTeamTotals(scores, CRITERIA)).gamma;
    expect(gamma).toMatchObject({
      awardType: 'technical',
      totalScore: 30,
      averageScore: 15,
      weightedScore: 7.67,
      totalScores: 4,
      judgeCount: 2,
    });
    const averages = computeCriteriaAverages(CRITERIA, scores).filter((a) => a.teamId === 'gamma');
    expect(averages.map((a) => a.criterionId)).toEqual(['C1', 'C2']);
  });
});

describe('computeTeamTotals — edge cases', () => {
  it('ignores rows whose criterion is unknown', () => {
    const scores = [
      row(TEAMS.alpha, 'j1', 'C1', 8),
      { ...row(TEAMS.alpha, 'j1', 'C1', 8), criterion: { ...CRITERIA[0], id: 'ghost' } },
    ];
    expect(byTeam(computeTeamTotals(scores, CRITERIA)).alpha).toMatchObject({
      totalScore: 8,
      totalScores: 1,
    });
  });

  it('computeCriteriaAverages ignores rows whose criterion is unknown too', () => {
    const scores = [
      row(TEAMS.alpha, 'j1', 'C1', 8),
      { ...row(TEAMS.alpha, 'j1', 'C1', 2), criterion: { ...CRITERIA[0], id: 'ghost' } },
    ];
    expect(computeCriteriaAverages(CRITERIA, scores)).toEqual([
      expect.objectContaining({
        teamId: 'alpha',
        criterionId: 'C1',
        averageScore: 8,
        judgeCount: 1,
      }),
    ]);
  });

  it('falls back to W = 100 when the applicable weights sum to zero', () => {
    const zeroWeights = CRITERIA.map((c) => ({ ...c, weight: 0 }));
    const alpha = byTeam(computeTeamTotals(dataset(), zeroWeights)).alpha;
    expect(alpha.weightedScore).toBe(0);
    expect(alpha.totalScore).toBe(30);
  });

  it('returns an empty list for no scores', () => {
    expect(computeTeamTotals([], CRITERIA)).toEqual([]);
    expect(computeCriteriaAverages(CRITERIA, [])).toEqual([]);
  });
});

describe('sortTeamTotals / scoreForMode', () => {
  const totals = computeTeamTotals(dataset(), CRITERIA);

  it('does not mutate its input and breaks ties by total then presentation order', () => {
    const copy = [...totals];
    sortTeamTotals(totals, 'weighted');
    expect(totals).toEqual(copy);

    const tied = totals.map((t) => ({ ...t, averageScore: 10 }));
    expect(sortTeamTotals(tied, 'average').map((t) => t.teamId)).toEqual([
      'gamma',
      'beta',
      'alpha',
    ]);
    const allTied = totals.map((t) => ({ ...t, averageScore: 10, totalScore: 1 }));
    expect(sortTeamTotals(allTied, 'average').map((t) => t.teamId)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });

  it('picks the column for the mode', () => {
    const alpha = byTeam(totals).alpha;
    expect(scoreForMode(alpha, 'total')).toBe(30);
    expect(scoreForMode(alpha, 'average')).toBe(15);
    expect(scoreForMode(alpha, 'weighted')).toBe(7.5);
  });
});

describe('rankTeamTotals', () => {
  const totals = computeTeamTotals(dataset(), CRITERIA);

  it('numbers the rows in sorted order and flags nothing when every score differs', () => {
    expect(rankTeamTotals(totals, 'weighted').map((t) => [t.rank, t.teamId, t.tied])).toEqual([
      [1, 'alpha', false],
      [2, 'beta', false],
      [3, 'gamma', false],
    ]);
    expect(rankTeamTotals([], 'total')).toEqual([]);
  });

  it('flags every row of a run of equal scores, and only those, in the ranked mode', () => {
    const tied = totals.map((t) => ({ ...t, averageScore: 10 }));
    expect(rankTeamTotals(tied, 'average').every((t) => t.tied)).toBe(true);
    // the same rows are not tied in another mode
    expect(rankTeamTotals(tied, 'total').some((t) => t.tied)).toBe(false);

    const two = totals.map((t) => (t.teamId === 'gamma' ? t : { ...t, totalScore: 30 }));
    expect(rankTeamTotals(two, 'total').map((t) => [t.teamId, t.tied])).toEqual([
      ['gamma', false],
      ['alpha', true],
      ['beta', true],
    ]);
  });

  it('keeps consecutive ranks for tied rows and does not mutate its input', () => {
    const tied = totals.map((t) => ({ ...t, totalScore: 1 }));
    const copy = structuredClone(tied);
    expect(rankTeamTotals(tied, 'total').map((t) => t.rank)).toEqual([1, 2, 3]);
    expect(tied).toEqual(copy);
    expect(tied[0]).not.toHaveProperty('tied');
  });
});

describe('formatAwardType', () => {
  it('prints General for both and capitalizes the rest', () => {
    expect(formatAwardType('both')).toBe('General');
    expect(formatAwardType('technical')).toBe('Technical');
    expect(formatAwardType('business')).toBe('Business');
  });
});
