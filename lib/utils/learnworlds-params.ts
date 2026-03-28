/**
 * Extract LearnWorlds referral parameters from the current URL.
 *
 * Handles two scenarios:
 * 1. Direct URL params (e.g., /auth/sign-up?ref=learnworlds&email=...)
 * 2. Params embedded in the `next` deep-link param set by middleware
 *    (e.g., /auth/login?next=/participant/event/abc?ref=learnworlds&email=...)
 *
 * Security: These values are only used for form pre-fill convenience.
 * They are never persisted to logs or localStorage (per FR-2 / LMS-03).
 */
export function getLearnWorldsParams(): {
  ref: string | null;
  email: string | null;
  isLearnWorlds: boolean;
  nextUrl: string | null;
} {
  if (typeof window === 'undefined') {
    return { ref: null, email: null, isLearnWorlds: false, nextUrl: null };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const nextUrl = searchParams.get('next');

  // Check direct URL params first
  let ref = searchParams.get('ref');
  let email = searchParams.get('email');

  // Fall back to params embedded in the `next` deep-link URL
  if (nextUrl) {
    try {
      const queryStart = nextUrl.indexOf('?');
      if (queryStart !== -1) {
        const nextSearchParams = new URLSearchParams(nextUrl.substring(queryStart + 1));
        ref = ref || nextSearchParams.get('ref');
        email = email || nextSearchParams.get('email');
      }
    } catch {
      // Invalid URL format in next param, ignore
    }
  }

  return {
    ref,
    email,
    isLearnWorlds: ref === 'learnworlds',
    nextUrl,
  };
}

/**
 * Get the clean deep-link path from the `next` URL param, stripping
 * LearnWorlds-specific query params (ref, email).
 *
 * Returns null if the URL is missing, fails validation, or targets
 * a non-participant path.
 *
 * Security: Only allows relative paths starting with `/participant`
 * to prevent open-redirect attacks (e.g., next=https://evil.com).
 */
export function getCleanParticipantNextUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const searchParams = new URLSearchParams(window.location.search);
  const nextUrl = searchParams.get('next');
  if (!nextUrl) return null;

  // Extract path portion (strip query params)
  const queryStart = nextUrl.indexOf('?');
  const path = queryStart === -1 ? nextUrl : nextUrl.substring(0, queryStart);

  // Only allow relative paths under /participant to prevent open redirects
  if (!path.startsWith('/participant')) return null;

  return path;
}

/** Allowed role-based dashboard routes */
const ROLE_DASHBOARDS: Record<string, string> = {
  super_admin: '/super-admin',
  admin: '/admin',
  judge: '/judge',
  participant: '/participant',
};

/**
 * Determine the post-auth redirect path based on user role and
 * any LearnWorlds deep-link URL.
 *
 * Used by the sign-up flow only. Login and passwordless flows
 * handle redirects via existing middleware `next` param logic.
 */
export function getPostAuthRedirect(role: string | undefined): string {
  // For participants, honour a validated deep-link if present
  if (role === 'participant') {
    const cleanNext = getCleanParticipantNextUrl();
    if (cleanNext) return cleanNext;
  }

  return ROLE_DASHBOARDS[role ?? ''] ?? '/';
}
