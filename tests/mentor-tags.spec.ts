import { expect, test } from '@playwright/test';
import {
  MENTOR_EXPERTISE_TAGS,
  MENTOR_ROLE_TAG,
  MENTOR_TAGS,
  getMentorExpertiseTag,
  getMentorExpertiseTags,
  hasMentorRoleTag,
} from '../lib/learnworlds/mentor-tags';

test.describe('LearnWorlds mentor tag contract', () => {
  test('defines the MD-03 role and expertise tags', () => {
    expect(MENTOR_ROLE_TAG).toBe('role_mentor');
    expect(MENTOR_EXPERTISE_TAGS).toEqual({
      AgriTech: 'mentor_agritech',
      Sustainability: 'mentor_sustainability',
      AI: 'mentor_ai',
    });
    expect(MENTOR_TAGS).toEqual([
      'role_mentor',
      'mentor_agritech',
      'mentor_sustainability',
      'mentor_ai',
    ]);
  });

  test('maps expertise answers to mentor tags', () => {
    expect(getMentorExpertiseTag('AgriTech')).toBe('mentor_agritech');
    expect(getMentorExpertiseTag(' sustainability ')).toBe('mentor_sustainability');
    expect(getMentorExpertiseTag('AI')).toBe('mentor_ai');
    expect(getMentorExpertiseTag('Product Strategy')).toBeNull();
  });

  test('detects mentor role and filters unsupported expertise values', () => {
    expect(hasMentorRoleTag(['learner', 'role_mentor'])).toBe(true);
    expect(hasMentorRoleTag(['learner'])).toBe(false);
    expect(hasMentorRoleTag(null)).toBe(false);

    expect(getMentorExpertiseTags(['AI', 'Unknown', 'AgriTech'])).toEqual([
      'mentor_ai',
      'mentor_agritech',
    ]);
  });
});
