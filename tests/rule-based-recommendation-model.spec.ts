import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateRuleBasedRecommendation } from '../lib/services/rule-based-recommendation-model';
import { db } from '../lib/db';

vi.mock('../lib/db', () => ({
  db: { select: vi.fn() },
}));

/*
  Build a Drizzle-compatible chainable mock that resolves to `result`.
  Handles both:
    - await db.select()...limit(1)  → .limit() returns a Promise
    - await db.select()...orderBy() → awaited directly via .then()
*/
function buildSelectMock(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain as unknown as ReturnType<typeof db.select>;
}

/*
  Set up db.select to return each result in order across sequential calls.
  Call 1 → latestEvent query
  Call 2 → activeProgress query
  Call 3 → itemDetails / nextItem / fallbackItem query (depends on which rule fires)
*/
function mockDbSequence(...results: unknown[][]) {
  const selectMock = vi.mocked(db.select);
  selectMock.mockReset();
  results.forEach((result) => selectMock.mockReturnValueOnce(buildSelectMock(result)));
}

const INACTIVE_TIMESTAMP = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(); // 60 days ago
const RECENT_TIMESTAMP = new Date(Date.now() - 1 * 3600 * 1000).toISOString();          // 1 hour ago

describe('generateRuleBasedRecommendation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resume_inactivity: recommends last in-progress course after 14+ days of inactivity', async () => {
    mockDbSequence(
      // latestEvent: on courseEpi, 60 days ago
      [{ itemId: 'BIO-340-test', eventTimestamp: INACTIVE_TIMESTAMP, eventType: 'started',
         learnworldsUserId: 'u1', itemType: 'course', source: 'learnworlds',
         id: '1', metadata: null, createdAt: INACTIVE_TIMESTAMP, eventValue: null }],
      // activeProgress: courseEpi still in-progress
      [{ courseId: 'BIO-340-test', completionStatus: 'in_progress', progressPercentage: '65',
         learnworldsUserId: 'u1' }],
      // itemDetails for courseEpi
      [{ title: 'BIO 340: Epigenetics and DNA Methylation' }],
    );

    const result = await generateRuleBasedRecommendation('u1');

    expect(result.ruleMatched).toBe('resume_inactivity');
    expect(result.source).toBe('rule');
    expect(result.recommendedItemId).toBe('BIO-340-test');
    expect(result.recommendedTitle).toBe('BIO 340: Epigenetics and DNA Methylation');
  });

  it('resume_inactivity guard: skips rule when latest event is on a now-completed course', async () => {
    mockDbSequence(
      // latestEvent: on courseEpi, 60 days ago — but courseEpi is now completed
      [{ itemId: 'BIO-340-test', eventTimestamp: INACTIVE_TIMESTAMP, eventType: 'completed',
         learnworldsUserId: 'u2', itemType: 'course', source: 'learnworlds',
         id: '2', metadata: null, createdAt: INACTIVE_TIMESTAMP, eventValue: null }],
      // activeProgress: courseEpi completed, course3D in-progress at 85%
      [
        { courseId: 'BIO-450-test', completionStatus: 'in_progress', progressPercentage: '85', learnworldsUserId: 'u2' },
        { courseId: 'BIO-340-test', completionStatus: 'completed',   progressPercentage: '100', learnworldsUserId: 'u2' },
      ],
      // itemDetails for course3D (Rule 2 fires instead)
      [{ title: 'BIO 450: 3D Genome Architecture' }],
    );

    const result = await generateRuleBasedRecommendation('u2');

    // Rule 1 must NOT fire; Rule 2 should fire
    expect(result.ruleMatched).toBe('high_progress');
    expect(result.recommendedItemId).toBe('BIO-450-test');
  });

  it('high_progress: recommends course when user is 80%+ complete', async () => {
    mockDbSequence(
      // latestEvent: recent (< 14 days) — inactivity threshold not crossed
      [{ itemId: 'BIO-450-test', eventTimestamp: RECENT_TIMESTAMP, eventType: 'progressed',
         learnworldsUserId: 'u3', itemType: 'course', source: 'learnworlds',
         id: '3', metadata: null, createdAt: RECENT_TIMESTAMP, eventValue: null }],
      // activeProgress: course3D in-progress at 85%
      [{ courseId: 'BIO-450-test', completionStatus: 'in_progress', progressPercentage: '85',
         learnworldsUserId: 'u3' }],
      // itemDetails for course3D
      [{ title: 'BIO 450: 3D Genome Architecture' }],
    );

    const result = await generateRuleBasedRecommendation('u3');

    expect(result.ruleMatched).toBe('high_progress');
    expect(result.source).toBe('rule');
    expect(result.recommendedItemId).toBe('BIO-450-test');
    expect(result.recommendedTitle).toBe('BIO 450: 3D Genome Architecture');
  });

  it('next_step_progression: recommends the course that follows a completed prerequisite', async () => {
    mockDbSequence(
      // no events — Rules 1 and 2 cannot fire
      [],
      // activeProgress: courseEpi completed, nothing in-progress
      [{ courseId: 'BIO-340-test', completionStatus: 'completed', progressPercentage: '100',
         learnworldsUserId: 'u4' }],
      // nextItem whose prerequisiteItemId = courseEpi
      [{ itemId: 'BIO-450-test', title: 'BIO 450: 3D Genome Architecture',
         prerequisiteItemId: 'BIO-340-test', isActive: true }],
    );

    const result = await generateRuleBasedRecommendation('u4');

    expect(result.ruleMatched).toBe('next_step_progression');
    expect(result.source).toBe('rule');
    expect(result.recommendedItemId).toBe('BIO-450-test');
  });

  it('default_popular: returns fallback for a cold start user with no history', async () => {
    mockDbSequence(
      [],  // no events
      [],  // no learner progress
      [{ itemId: 'BIO-340', title: 'Foundations Course', isActive: true }],  // fallback item
    );

    const result = await generateRuleBasedRecommendation('u5-new');

    expect(result.ruleMatched).toBe('default_popular');
    expect(result.source).toBe('fallback');
    expect(result.recommendedItemId).toBe('BIO-340');
    expect(result.recommendedTitle).toBe('Foundations Course');
  });

  it('throws when DEFAULT_FALLBACK_ITEM_ID is not seeded in learning_items', async () => {
    mockDbSequence(
      [],  // no events
      [],  // no learner progress
      [],  // fallback item missing from catalog
    );

    await expect(generateRuleBasedRecommendation('u6-new')).rejects.toThrow(
      "Fallback item 'BIO-340' not found in"
    );
  });
});