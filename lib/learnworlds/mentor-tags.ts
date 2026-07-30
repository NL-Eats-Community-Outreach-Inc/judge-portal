/**
 * Canonical mentor tag contract for MD-03.
 *
 * Applies these tags when a user submits the mentor application
 * form. The mentor webhook can use `role_mentor` to identify mentor applicants,
 * and downstream mentor directory features can use the expertise tags stored in
 * `mentor_profiles.tags` for filtering and display.
 */
export const MENTOR_ROLE_TAG = 'role_mentor' as const;

export const MENTOR_EXPERTISE_TAGS = {
  AgriTech: 'mentor_agritech',
  Sustainability: 'mentor_sustainability',
  AI: 'mentor_ai',
} as const;

export type MentorExpertise = keyof typeof MENTOR_EXPERTISE_TAGS;
export type MentorExpertiseTag = (typeof MENTOR_EXPERTISE_TAGS)[MentorExpertise];
export type MentorTag = typeof MENTOR_ROLE_TAG | MentorExpertiseTag;

export const MENTOR_TAGS = [MENTOR_ROLE_TAG, ...Object.values(MENTOR_EXPERTISE_TAGS)] as const;

const EXPERTISE_TAG_BY_NORMALIZED_LABEL = new Map<string, MentorExpertiseTag>(
  Object.entries(MENTOR_EXPERTISE_TAGS).map(([label, tag]) => [
    normalizeMentorExpertiseLabel(label),
    tag,
  ])
);

export function hasMentorRoleTag(tags: readonly string[] | null | undefined): boolean {
  return tags?.includes(MENTOR_ROLE_TAG) ?? false;
}

export function getMentorExpertiseTag(expertise: string): MentorExpertiseTag | null {
  return EXPERTISE_TAG_BY_NORMALIZED_LABEL.get(normalizeMentorExpertiseLabel(expertise)) ?? null;
}

export function getMentorExpertiseTags(expertiseAnswers: readonly string[]): MentorExpertiseTag[] {
  const tags = expertiseAnswers.flatMap((answer) => {
    const tag = getMentorExpertiseTag(answer);
    return tag ? [tag] : [];
  });

  return [...new Set(tags)];
}

function normalizeMentorExpertiseLabel(value: string): string {
  return value.trim().toLowerCase();
}
