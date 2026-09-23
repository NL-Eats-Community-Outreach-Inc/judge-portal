/**
 * Results math, shared by `/api/admin/results` and both CSV exports.
 *
 * Everything here is pure: the caller loads the counted score rows (scores from
 * judges currently assigned to the event) and this module turns them into the
 * per-team totals, averages and weighted scores the dashboard shows.
 *
 * Rules (see documents/2026/4-VERIFICATION-RUNBOOK.md Part II §2.5; internal, not in the repository):
 * - only criteria matching the team's award type count (`both` counts all);
 * - `W` = sum of the weights of those criteria, 100 when there are none;
 * - per judge: `judge_total = Σ score`, `judge_weighted = Σ score × weight / W`;
 * - per team, over judges with at least one counted row:
 *   total = Σ judge_total, average = mean(judge_total), weighted = mean(judge_weighted);
 * - two decimals, rounded half away from zero (what Postgres `ROUND(numeric, 2)` does).
 *
 * Scores and weights are integers, so every intermediate value is a rational
 * number with an integer numerator and denominator; rounding happens on the
 * exact fraction, never on a floating-point approximation.
 */
import type {
  AwardType,
  CriteriaCategory,
  ScoreMode,
  TeamTotal,
  RankedTeamTotal,
  CriteriaAverage,
} from './types';

/** The subset of a counted score row the math needs. */
export interface CountedScore {
  score: number;
  team: { id: string; name: string; presentationOrder: number; awardType: AwardType };
  criterion: { id: string; name: string; category: CriteriaCategory; displayOrder: number };
  judge: { id: string };
}

/** A criterion as the math needs it (weight is what the totals are based on). */
export interface WeightedCriterion {
  id: string;
  category: CriteriaCategory;
  weight: number;
}

/** True when a criterion of `category` counts for a team with `awardType`. */
export function criterionApplies(awardType: AwardType, category: CriteriaCategory): boolean {
  return awardType === 'both' || awardType === category;
}

/** The criteria that count for a team with `awardType`, in the given order. */
export function applicableCriteria<C extends { category: CriteriaCategory }>(
  awardType: AwardType,
  criteria: C[]
): C[] {
  return criteria.filter((criterion) => criterionApplies(awardType, criterion.category));
}

/**
 * `numerator / denominator` rounded to two decimals, half away from zero, using
 * integer arithmetic only. Both arguments must be integers; the denominator
 * must not be zero.
 */
export function roundRational(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
    throw new RangeError('roundRational expects integer arguments and a non-zero denominator');
  }
  const negative = numerator < 0 !== denominator < 0;
  const p = Math.abs(numerator) * 100;
  const q = Math.abs(denominator);
  // floor(p/q + 1/2) without leaving the integers
  const hundredths = Math.floor((2 * p + q) / (2 * q));
  const value = hundredths / 100;
  return negative ? -value : value;
}

/**
 * Per-team totals from the counted rows. Teams with no counted row are absent.
 * The result is ordered by total score, highest first (ties by presentation
 * order); use `sortTeamTotals` for the other modes.
 */
export function computeTeamTotals(
  scores: CountedScore[],
  criteria: WeightedCriterion[]
): TeamTotal[] {
  type JudgeAccumulator = { total: number; weightedNumerator: number; rows: number };
  type TeamAccumulator = {
    team: CountedScore['team'];
    judges: Map<string, JudgeAccumulator>;
  };

  const weightByCriterion = new Map(criteria.map((c) => [c.id, c]));
  const teams = new Map<string, TeamAccumulator>();

  for (const row of scores) {
    const criterion = weightByCriterion.get(row.criterion.id);
    if (!criterion || !criterionApplies(row.team.awardType, criterion.category)) continue;

    let team = teams.get(row.team.id);
    if (!team) {
      team = { team: row.team, judges: new Map() };
      teams.set(row.team.id, team);
    }
    let judge = team.judges.get(row.judge.id);
    if (!judge) {
      judge = { total: 0, weightedNumerator: 0, rows: 0 };
      team.judges.set(row.judge.id, judge);
    }
    judge.total += row.score;
    judge.weightedNumerator += row.score * criterion.weight;
    judge.rows += 1;
  }

  const totals: TeamTotal[] = [];
  for (const { team, judges } of teams.values()) {
    const weightSum = applicableCriteria(team.awardType, criteria).reduce(
      (sum, c) => sum + c.weight,
      0
    );
    // The SQL used COALESCE(total_weight, 100); a zero total would divide by zero there
    const totalWeight = weightSum > 0 ? weightSum : 100;
    const judgeCount = judges.size;

    let totalScore = 0;
    let weightedNumerator = 0;
    let totalScores = 0;
    for (const judge of judges.values()) {
      totalScore += judge.total;
      weightedNumerator += judge.weightedNumerator;
      totalScores += judge.rows;
    }

    totals.push({
      teamId: team.id,
      teamName: team.name,
      presentationOrder: team.presentationOrder,
      awardType: team.awardType,
      totalScore,
      averageScore: roundRational(totalScore, judgeCount),
      weightedScore: roundRational(weightedNumerator, totalWeight * judgeCount),
      totalScores,
      judgeCount,
    });
  }

  return sortTeamTotals(totals, 'total');
}

/** The score a team is ranked by in `mode`. */
export function scoreForMode(total: TeamTotal, mode: ScoreMode): number {
  switch (mode) {
    case 'average':
      return total.averageScore;
    case 'weighted':
      return total.weightedScore;
    default:
      return total.totalScore;
  }
}

/** A copy of `totals` ranked by `mode`, highest first; ties keep presentation order. */
export function sortTeamTotals(totals: TeamTotal[], mode: ScoreMode): TeamTotal[] {
  return [...totals].sort(
    (a, b) =>
      scoreForMode(b, mode) - scoreForMode(a, mode) ||
      b.totalScore - a.totalScore ||
      a.presentationOrder - b.presentationOrder
  );
}

/**
 * `totals` ranked by `mode` (see `sortTeamTotals`) with the position as `rank`
 * and `tied` set on every row whose score in `mode` equals the row before or
 * after it. Tied rows keep consecutive ranks; the flag is what tells the
 * reader that the order between them is the tie-break, not a result.
 */
export function rankTeamTotals(totals: TeamTotal[], mode: ScoreMode): RankedTeamTotal[] {
  const sorted = sortTeamTotals(totals, mode);
  return sorted.map((total, index) => {
    const score = scoreForMode(total, mode);
    const previous = sorted[index - 1];
    const next = sorted[index + 1];
    const tied =
      (previous !== undefined && scoreForMode(previous, mode) === score) ||
      (next !== undefined && scoreForMode(next, mode) === score);
    return { ...total, rank: index + 1, tied };
  });
}

/**
 * Mean counted score per team and criterion, ordered by presentation order then
 * criterion display order. Rows whose criterion is not one of `criteria` are
 * ignored, like `computeTeamTotals` does.
 */
export function computeCriteriaAverages(
  criteria: Array<{ id: string }>,
  scores: CountedScore[]
): CriteriaAverage[] {
  type Accumulator = {
    team: CountedScore['team'];
    criterion: CountedScore['criterion'];
    sum: number;
    count: number;
  };
  const known = new Set(criteria.map((c) => c.id));
  const groups = new Map<string, Accumulator>();

  for (const row of scores) {
    if (!known.has(row.criterion.id)) continue;
    if (!criterionApplies(row.team.awardType, row.criterion.category)) continue;
    const key = `${row.team.id}:${row.criterion.id}`;
    let group = groups.get(key);
    if (!group) {
      group = { team: row.team, criterion: row.criterion, sum: 0, count: 0 };
      groups.set(key, group);
    }
    group.sum += row.score;
    group.count += 1;
  }

  return [...groups.values()]
    .sort(
      (a, b) =>
        a.team.presentationOrder - b.team.presentationOrder ||
        a.criterion.displayOrder - b.criterion.displayOrder
    )
    .map((group) => ({
      teamId: group.team.id,
      teamName: group.team.name,
      criterionId: group.criterion.id,
      criterionName: group.criterion.name,
      averageScore: roundRational(group.sum, group.count),
      judgeCount: group.count,
    }));
}

/** Award type as the CSV exports print it. */
export function formatAwardType(awardType: AwardType): string {
  if (awardType === 'both') return 'General';
  return awardType.charAt(0).toUpperCase() + awardType.slice(1);
}
