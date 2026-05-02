import { expect, test } from '@playwright/test';
import {
  LEARNWORLDS_MENTOR_EXPERTISE_TAGS,
  LEARNWORLDS_MENTOR_ROLE_TAG,
  LEARNWORLDS_MENTOR_TAGS,
  getLearnworldsMentorExpertiseTag,
  getLearnworldsMentorExpertiseTags,
  hasLearnworldsMentorRoleTag,
} from '../lib/learnworlds/mentor-tags';

test.describe('LearnWorlds mentor tag contract', () => {
  test('defines the MD-03 role and expertise tags', () => {
    expect(LEARNWORLDS_MENTOR_ROLE_TAG).toBe('role_mentor');
    expect(LEARNWORLDS_MENTOR_EXPERTISE_TAGS).toEqual({
      AgriTech: 'mentor_agritech',
      Sustainability: 'mentor_sustainability',
      AI: 'mentor_ai',
    });
    expect(LEARNWORLDS_MENTOR_TAGS).toEqual([
      'role_mentor',
      'mentor_agritech',
      'mentor_sustainability',
      'mentor_ai',
    ]);
  });

  test('maps LearnWorlds expertise answers to mentor tags', () => {
    expect(getLearnworldsMentorExpertiseTag('AgriTech')).toBe('mentor_agritech');
    expect(getLearnworldsMentorExpertiseTag(' sustainability ')).toBe('mentor_sustainability');
    expect(getLearnworldsMentorExpertiseTag('AI')).toBe('mentor_ai');
    expect(getLearnworldsMentorExpertiseTag('Product Strategy')).toBeNull();
  });

  test('detects mentor role and filters unsupported expertise values', () => {
    expect(hasLearnworldsMentorRoleTag(['learner', 'role_mentor'])).toBe(true);
    expect(hasLearnworldsMentorRoleTag(['learner'])).toBe(false);
    expect(hasLearnworldsMentorRoleTag(null)).toBe(false);

    expect(getLearnworldsMentorExpertiseTags(['AI', 'Unknown', 'AgriTech'])).toEqual([
      'mentor_ai',
      'mentor_agritech',
    ]);
  });
});
