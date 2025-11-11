import { NextRequest, NextResponse } from 'next/server';
import { getInvitationByToken, isInvitationValid } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/invite/validate
 * Validates an invitation token and sends OTP code via email
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get invitation
    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation' },
        { status: 404 }
      );
    }

    // Validate invitation
    const validationResult = isInvitationValid(invitation);
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.reason },
        { status: 400 }
      );
    }

    // Get event details
    const event = await db
      .select()
      .from(events)
      .where(eq(events.id, invitation.eventId))
      .limit(1);

    if (!event[0]) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Trigger OTP code email via Supabase
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: invitation.email,
      options: {
        // Don't set emailRedirectTo - this makes Supabase send a 6-digit code instead of a magic link
        shouldCreateUser: true, // Allow new judges to receive OTP; user will be created on verification
      },
    });

    if (error) {
      console.error('OTP send error:', error);
      return NextResponse.json(
        { error: 'Failed to send verification code' },
        { status: 500 }
      );
    }

    // Return invitation details (without sensitive data)
    return NextResponse.json({
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        customMessage: invitation.customMessage,
        event: {
          id: event[0].id,
          name: event[0].name,
          description: event[0].description,
        },
      },
    });
  } catch (error) {
    console.error('Invitation validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
