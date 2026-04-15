import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { submissions, teamMembers, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, submissionText } = await req.json();

    if (!submissionText) {
      return NextResponse.json({ error: 'Missing submission text' }, { status: 400 });
    }

    // Verify user is on the team
    const membership = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.participantId, user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Not part of this team' }, { status: 403 });
    }

    const teamRecord = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

    if (teamRecord.length === 0) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const eventId = teamRecord[0].eventId;

    const existing = await db
        .select()
        .from(submissions)
        .where(
            and(
            eq(submissions.teamId, teamId),
            eq(submissions.eventId, eventId)
            )
        )
        .limit(1);

        if (existing.length > 0) {
        return NextResponse.json(
            { error: 'Submission already exists for this team' },
            { status: 400 }
        );
        }

    //insert submission ( 1 per team+event)
    await db.insert(submissions).values({
      eventId,
      teamId,
      submissionText,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Handle duplicate submission
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Submission already exists for this team' },
        { status: 400 }
      );
    }

    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}