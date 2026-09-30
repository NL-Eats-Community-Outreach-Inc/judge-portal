import { NextRequest, NextResponse } from 'next/server';
import { getInvitationByToken, isInvitationValid } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { EMAIL_FEATURES_ENABLED } from '@/lib/config';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

/**
 * GET /api/invite/validate?token=xxx
 * Returns invitation info without sending OTP (for display purposes)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return sendApiError(400, 'BAD_REQUEST', 'Token is required');
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

    // Get org name for admin invites
    let organizationName: string | null = null;
    if (invitation.organizationId) {
      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, invitation.organizationId))
        .limit(1);
      organizationName = org?.name || null;
    }

    return NextResponse.json({
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        customMessage: invitation.customMessage,
        organizationName,
      },
    });
  } catch (error) {
    return handleRouteError(error, 'Invitation info error');
  }
}

/**
 * POST /api/invite/validate
 * Validates an invitation token and sends OTP code via email.
 *
 * Kept for the email-based flow behind EMAIL_FEATURES_ENABLED; with the flag
 * off it answers 404 before reading the body so no email can ever be sent.
 */
export async function POST(request: NextRequest) {
  try {
    if (!EMAIL_FEATURES_ENABLED) {
      return sendApiError(404, 'FEATURE_DISABLED', 'Email verification is not available');
    }

    const { token } = await request.json();

    if (!token) {
      return sendApiError(400, 'BAD_REQUEST', 'Token is required');
    }

    // Get invitation
    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      return sendApiError(404, 'NOT_FOUND', 'Invalid invitation');
    }

    // Validate invitation
    const validationResult = isInvitationValid(invitation);
    if (!validationResult.valid) {
      return sendApiError(
        400,
        'INVITATION_INVALID',
        validationResult.reason ?? 'Invalid invitation'
      );
    }

    // Trigger OTP code email via Supabase
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: invitation.email,
      options: {
        // Don't set emailRedirectTo - this makes Supabase send a 6-digit code instead of a magic link
        shouldCreateUser: true,
        data: {
          // CRITICAL: Add flag to prevent automatic user creation by trigger
          // The verify endpoint will create the user after OTP is confirmed
          invite_pending: true,
          role: invitation.role,
        },
      },
    });

    if (error) {
      console.error('OTP send error:', error);
      return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Failed to send verification code');
    }

    // Return invitation details (without sensitive data)
    return NextResponse.json({
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        customMessage: invitation.customMessage,
      },
    });
  } catch (error) {
    return handleRouteError(error, 'Invitation validation error');
  }
}
