import { NextRequest, NextResponse } from 'next/server';
import {
  getInvitationByToken,
  isInvitationValid,
  finalizeInvitationAcceptance,
  acceptInvitationForExistingUser,
} from '@/lib/auth/invitation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { EMAIL_FEATURES_ENABLED } from '@/lib/config';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

/**
 * POST /api/invite/verify
 * Verifies an OTP code and completes the invitation acceptance.
 *
 * Kept for the email-based flow behind EMAIL_FEATURES_ENABLED; the UI now
 * uses /api/invite/accept, which sets a password instead of sending a code.
 * With the flag off it answers 404 before reading the body.
 */
export async function POST(request: NextRequest) {
  try {
    if (!EMAIL_FEATURES_ENABLED) {
      return sendApiError(404, 'FEATURE_DISABLED', 'Email verification is not available');
    }

    const { token, otp } = await request.json();

    if (!token || !otp) {
      return sendApiError(400, 'BAD_REQUEST', 'Token and OTP are required');
    }

    const invitation = await getInvitationByToken(token);
    if (!invitation) {
      return sendApiError(404, 'NOT_FOUND', 'Invalid invitation');
    }

    const validationResult = isInvitationValid(invitation);
    if (!validationResult.valid) {
      return sendApiError(
        400,
        'INVITATION_INVALID',
        validationResult.reason ?? 'Invalid invitation'
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: invitation.email,
      token: otp,
      type: 'email',
    });

    if (error || !data.user) {
      return sendApiError(400, 'INVALID_OTP', 'Invalid or expired OTP code');
    }

    const [existingUser] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, data.user.id))
      .limit(1);

    if (existingUser) {
      const result = await acceptInvitationForExistingUser(invitation, existingUser);
      if (!result.accepted) {
        return sendApiError(400, 'ALREADY_HAS_ACCOUNT', result.message, {
          existingRole: existingUser.role,
          redirectUrl: result.redirectUrl,
        });
      }
      return NextResponse.json({
        success: true,
        redirectUrl: result.redirectUrl,
        message: result.message,
        user: { id: existingUser.id, email: existingUser.email, role: existingUser.role },
      });
    }

    const { redirectUrl } = await finalizeInvitationAcceptance(invitation, data.user.id);

    return NextResponse.json({
      success: true,
      redirectUrl,
      user: { id: data.user.id, email: data.user.email, role: invitation.role },
    });
  } catch (error) {
    return handleRouteError(error, 'Invitation verification error');
  }
}
