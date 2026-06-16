import { NextRequest, NextResponse } from 'next/server';
import { getInvitationByToken, acceptInvitation, isInvitationValid } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/invite/verify
 * Verifies OTP and completes the invitation acceptance
 */
export async function POST(request: NextRequest) {
  try {
    const { token, otp } = await request.json();

    if (!token || !otp) {
      return NextResponse.json({ error: 'Token and OTP are required' }, { status: 400 });
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

    // Verify OTP with Supabase
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: invitation.email,
      token: otp,
      type: 'email',
    });

    if (error || !data.user) {
      return NextResponse.json({ error: 'Invalid or expired OTP code' }, { status: 400 });
    }

    // Check if user already exists in our database
    const existingUser = await db.select().from(users).where(eq(users.id, data.user.id)).limit(1);

    if (existingUser[0]) {
      // Multi-org support: existing judge + judge invite with orgId → add to new org
      if (
        existingUser[0].role === 'judge' &&
        invitation.role === 'judge' &&
        invitation.organizationId
      ) {
        const existingMembership = await db
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, existingUser[0].id),
              eq(organizationMembers.organizationId, invitation.organizationId)
            )
          )
          .limit(1);

        if (existingMembership[0]) {
          return NextResponse.json(
            {
              error: 'You are already a member of this organization.',
              existingRole: existingUser[0].role,
              redirectUrl: '/judge',
            },
            { status: 400 }
          );
        }

        // Add judge to the new org
        await db.insert(organizationMembers).values({
          organizationId: invitation.organizationId,
          userId: existingUser[0].id,
        });

        await acceptInvitation(invitation.id);

        return NextResponse.json({
          success: true,
          redirectUrl: '/judge',
          message: 'You have been added to a new organization!',
          user: {
            id: existingUser[0].id,
            email: existingUser[0].email,
            role: existingUser[0].role,
          },
        });
      }

      // For non-judge roles or role mismatches, keep the existing rejection
      const roleRedirect =
        existingUser[0].role === 'admin'
          ? '/admin'
          : existingUser[0].role === 'judge'
            ? '/judge'
            : '/participant';

      return NextResponse.json(
        {
          error:
            'You already have an account. Please contact an administrator if you need a role change.',
          existingRole: existingUser[0].role,
          redirectUrl: roleRedirect,
        },
        { status: 400 }
      );
    }

    // Create new user record with role from invitation
    // For admin invites, also set organizationId from the invitation
    await db.insert(users).values({
      id: data.user.id,
      email: invitation.email,
      role: invitation.role,
      organizationId: invitation.role === 'admin' ? invitation.organizationId : null,
    });

    // For judge invites with org, create organization membership
    if (invitation.role === 'judge' && invitation.organizationId) {
      await db.insert(organizationMembers).values({
        organizationId: invitation.organizationId,
        userId: data.user.id,
      });
    }

    // Accept invitation (mark as accepted)
    await acceptInvitation(invitation.id);

    // Determine redirect URL based on role
    const redirectUrl =
      invitation.role === 'admin'
        ? '/admin'
        : invitation.role === 'judge'
          ? '/judge'
          : '/participant';

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
