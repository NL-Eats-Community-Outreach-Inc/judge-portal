import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  users,
  organizationMembers,
  eventJudges,
  teamMembers,
  teams,
  eventParticipants,
  scores,
} from '@/lib/db/schema';
import { eq, and, sql, asc } from 'drizzle-orm';

const VALID_ROLES = ['admin', 'judge', 'participant'] as const;

export async function PUT(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const currentUser = await authServer.requireSuperAdmin();
    const { userId } = await params;
    const { role, organizationId } = await request.json();

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Cannot change own role
    if (userId === currentUser.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // Verify user exists
    const [targetUser] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cannot change another super_admin's role
    if (targetUser.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot change super admin role' }, { status: 403 });
    }

    // When promoting to admin, organizationId is required
    if (role === 'admin' && !organizationId) {
      return NextResponse.json(
        { error: 'Organization is required when assigning admin role' },
        { status: 400 }
      );
    }

    // Set organizationId: use provided value for admin, null for others
    const orgId = role === 'admin' ? organizationId : null;

    // Same-role guard: skip FROM-role cleanup if role isn't actually changing
    if (targetUser.role === role) {
      const [updatedUser] = await db
        .update(users)
        .set({
          role,
          organizationId: orgId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .returning();

      return NextResponse.json({ user: updatedUser });
    }

    // Role is changing — perform FROM-role cleanup + UPDATE in a transaction
    const [updatedUser] = await db.transaction(async (tx) => {
      // FROM-role cleanup
      if (targetUser.role === 'judge') {
        // Delete all organization_members entries
        await tx.delete(organizationMembers).where(eq(organizationMembers.userId, userId));

        // For event_judges: score-existence check — DELETE where no scores, PRESERVE where scores exist
        await tx.delete(eventJudges).where(
          and(
            eq(eventJudges.judgeId, userId),
            sql`NOT EXISTS (
                SELECT 1 FROM scores
                WHERE scores.judge_id = ${eventJudges.judgeId}
                  AND scores.event_id = ${eventJudges.eventId}
              )`
          )
        );
      } else if (targetUser.role === 'participant') {
        // Get all team memberships for this participant
        const membershipRows = await tx
          .select({
            teamId: teamMembers.teamId,
            isCreator: teamMembers.isCreator,
          })
          .from(teamMembers)
          .where(eq(teamMembers.participantId, userId));

        for (const membership of membershipRows) {
          if (membership.isCreator) {
            // Transfer creator to earliest-joined member (by joinedAt, tiebreak by id)
            const [nextMember] = await tx
              .select({ id: teamMembers.id, participantId: teamMembers.participantId })
              .from(teamMembers)
              .where(
                and(
                  eq(teamMembers.teamId, membership.teamId),
                  sql`${teamMembers.participantId} != ${userId}`
                )
              )
              .orderBy(asc(teamMembers.joinedAt), asc(teamMembers.id))
              .limit(1);

            if (nextMember) {
              await tx
                .update(teamMembers)
                .set({ isCreator: true })
                .where(eq(teamMembers.id, nextMember.id));
            }
          }

          // Delete this participant's team_members entry
          await tx
            .delete(teamMembers)
            .where(
              and(eq(teamMembers.teamId, membership.teamId), eq(teamMembers.participantId, userId))
            );

          // Check if team is now empty
          const remainingMembers = await tx
            .select({ id: teamMembers.id })
            .from(teamMembers)
            .where(eq(teamMembers.teamId, membership.teamId))
            .limit(1);

          if (remainingMembers.length === 0) {
            // Score-existence check on team: delete if no scores, preserve if scores exist
            const teamScores = await tx
              .select({ id: scores.id })
              .from(scores)
              .where(eq(scores.teamId, membership.teamId))
              .limit(1);

            if (teamScores.length === 0) {
              await tx.delete(teams).where(eq(teams.id, membership.teamId));
            }
          }
        }

        // Delete all event_participants entries
        await tx.delete(eventParticipants).where(eq(eventParticipants.participantId, userId));
      }
      // admin → X: no cleanup needed (organizationId handled by the UPDATE)

      // Update the user's role
      return await tx
        .update(users)
        .set({
          role,
          organizationId: orgId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .returning();
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
