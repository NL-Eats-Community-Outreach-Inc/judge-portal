import { NextRequest, NextResponse } from 'next/server';
import { getInvitationByToken, acceptInvitation, isInvitationValid } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/invite/verify
 * Verifies OTP and completes the invitation acceptance
 */
export async function POST(request: NextRequest) {
  try {
    const { token, otp } = await request.json();

    if (!token || !otp) {
      return NextResponse.json(
        { error: 'Token and OTP are required' },
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

    // Verify OTP with Supabase
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: invitation.email,
      token: otp,
      type: 'email',
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP code' },
        { status: 400 }
      );
    }

    // Check if user already exists in our database
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, data.user.id))
      .limit(1);

    // If user doesn't exist, create user record
    if (!existingUser[0]) {
      await db.insert(users).values({
        id: data.user.id,
        email: invitation.email,
        role: invitation.role, // Use role from invitation
      });
    } else {
      // Update user role if it's different
      if (existingUser[0].role !== invitation.role) {
        await db
          .update(users)
          .set({
            role: invitation.role,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, data.user.id));
      }
    }

    // Accept invitation (mark as accepted and assign to event)
    await acceptInvitation(invitation.id, data.user.id);

    // Determine redirect URL based on role
    const redirectUrl = invitation.role === 'judge' ? '/judge' : '/participant';

    return NextResponse.json({
      success: true,
      redirectUrl,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: invitation.role,
      },
    });
  } catch (error) {
    console.error('Invitation verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
