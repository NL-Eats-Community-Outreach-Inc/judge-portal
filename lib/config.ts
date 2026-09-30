/**
 * Feature flags. These document what is switched off rather than being
 * expected to flip back; both are compile-time constants.
 */

/**
 * There is no SMTP provider: the Supabase built-in mailer allows two emails per
 * hour for the whole project. Every email-dependent control (passwordless login
 * and sign-up, password reset by email, OTP invitation acceptance) is hidden.
 * Invitation links set a password instead, and the account holder resets
 * passwords in the Supabase dashboard (Authentication → Users).
 */
export const EMAIL_FEATURES_ENABLED = false;

/**
 * Team proposal submissions and the optional pre-screening service. The tables,
 * routes and UI are kept; the flag hides the proposal form and makes
 * `POST /api/submissions` answer 404. The scoring service is only called when
 * `AI_SCORING_URL` is set as well.
 */
export const SUBMISSIONS_ENABLED = false;
