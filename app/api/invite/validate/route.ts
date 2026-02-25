import { NextRequest, NextResponse } from 'next/server';
import { getInvitationByToken, isInvitationValid } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/invite/validate?token=xxx
 * Returns invitation info without sending OTP (for display purposes)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
    }

    const validationResult = isInvitationValid(invitation);
    if (!validationResult.valid) {
      return NextResponse.json({ error: validationResult.reason }, { status: 400 });
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
    console.error('Invitation info error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/invite/validate
 * Validates an invitation token and sends OTP code via email
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Get invitation
    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
    }

    // Validate invitation
    const validationResult = isInvitationValid(invitation);
    if (!validationResult.valid) {
      return NextResponse.json({ error: validationResult.reason }, { status: 400 });
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
      return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
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
    console.error('Invitation validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
