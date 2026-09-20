/**
 * The runbook §3 dataset (state S0) in the shape `loadCountedScores` and
 * `loadEventCriteria` return, for the results route specs.
 */
import type { ResultScore } from '@/lib/types';

export const CRITERIA = [
  {
    id: 'C1',
    name: 'QA-Tech-Merit',
    category: 'technical' as const,
    weight: 40,
    displayOrder: 1,
    maxScore: 10,
  },
  {
    id: 'C2',
    name: 'QA-Innovation',
    category: 'technical' as const,
    weight: 20,
    displayOrder: 2,
    maxScore: 10,
  },
  {
    id: 'C3',
    name: 'QA-Biz-Viability',
    category: 'business' as const,
    weight: 30,
    displayOrder: 3,
    maxScore: 10,
  },
  {
    id: 'C4',
    name: 'QA-Presentation',
    category: 'business' as const,
    weight: 10,
    displayOrder: 4,
    maxScore: 10,
  },
];

export const TEAMS = {
  alpha: { id: 'alpha', name: 'QA-Alpha', presentationOrder: 1, awardType: 'technical' as const },
  beta: { id: 'beta', name: 'QA-Beta', presentationOrder: 2, awardType: 'business' as const },
  gamma: {
    id: 'gamma',
    name: 'QA-Gamma "Quoted", Team',
    presentationOrder: 3,
    awardType: 'both' as const,
  },
  delta: { id: 'delta', name: 'QA-Delta', presentationOrder: 4, awardType: 'both' as const },
};

export const JUDGES = {
  j1: { id: 'j1', email: 'judge1@example.com' },
  j2: { id: 'j2', email: 'judge2@example.com' },
};

let counter = 0;
function row(
  team: ResultScore['team'],
  judge: ResultScore['judge'],
  criterionId: string,
  score: number
): ResultScore {
  const c = CRITERIA.find((x) => x.id === criterionId)!;
  counter += 1;
  return {
    id: `s${counter}`,
    score,
    comment: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    team,
    criterion: {
      id: c.id,
      name: c.name,
      displayOrder: c.displayOrder,
      minScore: 1,
      maxScore: c.maxScore,
      category: c.category,
    },
    judge,
  };
}

export const SCORES: ResultScore[] = [
  row(TEAMS.alpha, JUDGES.j1, 'C1', 8),
  row(TEAMS.alpha, JUDGES.j1, 'C2', 6),
  row(TEAMS.alpha, JUDGES.j2, 'C1', 7),
  row(TEAMS.alpha, JUDGES.j2, 'C2', 9),
  row(TEAMS.beta, JUDGES.j1, 'C3', 9),
  row(TEAMS.beta, JUDGES.j1, 'C4', 7),
  row(TEAMS.beta, JUDGES.j2, 'C3', 5),
  row(TEAMS.beta, JUDGES.j2, 'C4', 10),
  row(TEAMS.gamma, JUDGES.j1, 'C1', 10),
  row(TEAMS.gamma, JUDGES.j1, 'C2', 8),
  row(TEAMS.gamma, JUDGES.j1, 'C3', 6),
  row(TEAMS.gamma, JUDGES.j1, 'C4', 4),
  row(TEAMS.gamma, JUDGES.j2, 'C1', 6),
  row(TEAMS.gamma, JUDGES.j2, 'C2', 6),
];
