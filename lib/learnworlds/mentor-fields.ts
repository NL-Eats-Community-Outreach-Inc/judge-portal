/**
 * Custom User Fields for Mentor Profiles
 *
 *
 *
 *
 * Field naming convention: cf_mentor_<purpose>
 *
 *
 * Standard fields consumed by the mentor webhook are not listed
 * here because they are part of the default user payload, not custom fields:
 * - user_id maps to mentor_profiles.learnworlds_user_id
 * - full_name maps to mentor_profiles.full_name
 *
 *
 *
 */

/** Custom field definitions **/
export const MENTOR_FIELDS = {
  cf_mentor_title: {
    type: 'text' as const,
    label: 'Professional Title',
    dbColumn: 'title',
  },
  cf_mentor_org: {
    type: 'text' as const,
    label: 'Organization',
    dbColumn: 'organization',
  },
  cf_mentor_bio: {
    type: 'textarea' as const,
    label: 'Short Bio',
    dbColumn: 'bio',
  },
  cf_mentor_linkedin: {
    type: 'url' as const,
    label: 'LinkedIn Profile URL',
    dbColumn: 'linkedinUrl',
  },
  cf_mentor_email: {
    type: 'email' as const,
    label: 'Contact Email',
    dbColumn: null, // not stored in mentor_profiles; used for outreach only
  },
  cf_mentor_calendly: {
    type: 'url' as const,
    label: 'Calendly Booking Link',
    dbColumn: 'calendlyUrl',
  },
  cf_mentor_photo: {
    type: 'url' as const,
    label: 'Profile Photo URL',
    dbColumn: 'photoUrl',
  },
} as const;

/** LearnWorlds field name to mentor_profiles column (excludes fields with no DB mapping) */
export const FIELD_TO_DB_COLUMN: Record<string, string> = Object.fromEntries(
  Object.entries(MENTOR_FIELDS)
    .filter(([, v]) => v.dbColumn !== null)
    .map(([k, v]) => [k, v.dbColumn!])
);
