/**
 * Canonical LearnWorlds mentor tag contract for MD-03.
 *
 * LearnWorlds applies these tags when a user submits the mentor application
 * form. The mentor webhook can use `role_mentor` to identify mentor applicants,
 * and downstream mentor directory features can use the expertise tags stored in
 * `mentor_profiles.tags` for filtering and display.
 */
export const LEARNWORLDS_MENTOR_ROLE_TAG = 'role_mentor' as const;

export const LEARNWORLDS_MENTOR_EXPERTISE_TAGS = {
  AgriTech: 'mentor_agritech',
  Sustainability: 'mentor_sustainability',
  AI: 'mentor_ai',
} as const;

export type LearnworldsMentorExpertise = keyof typeof LEARNWORLDS_MENTOR_EXPERTISE_TAGS;
export type LearnworldsMentorExpertiseTag =
  (typeof LEARNWORLDS_MENTOR_EXPERTISE_TAGS)[LearnworldsMentorExpertise];
export type LearnworldsMentorTag =
  | typeof LEARNWORLDS_MENTOR_ROLE_TAG
  | LearnworldsMentorExpertiseTag;

export const LEARNWORLDS_MENTOR_TAGS = [
  LEARNWORLDS_MENTOR_ROLE_TAG,
  ...Object.values(LEARNWORLDS_MENTOR_EXPERTISE_TAGS),
] as const;

const EXPERTISE_TAG_BY_NORMALIZED_LABEL = new Map<string, LearnworldsMentorExpertiseTag>(
  Object.entries(LEARNWORLDS_MENTOR_EXPERTISE_TAGS).map(([label, tag]) => [
    normalizeMentorExpertiseLabel(label),
    tag,
  ])
);

export function hasLearnworldsMentorRoleTag(tags: readonly string[] | null | undefined): boolean {
  return tags?.includes(LEARNWORLDS_MENTOR_ROLE_TAG) ?? false;
}

export function getLearnworldsMentorExpertiseTag(
  expertise: string
): LearnworldsMentorExpertiseTag | null {
  return EXPERTISE_TAG_BY_NORMALIZED_LABEL.get(normalizeMentorExpertiseLabel(expertise)) ?? null;
}

export function getLearnworldsMentorExpertiseTags(
  expertiseAnswers: readonly string[]
): LearnworldsMentorExpertiseTag[] {
  return expertiseAnswers.flatMap((answer) => {
    const tag = getLearnworldsMentorExpertiseTag(answer);
    return tag ? [tag] : [];
  });
}

function normalizeMentorExpertiseLabel(value: string): string {
  return value.trim().toLowerCase();
}
