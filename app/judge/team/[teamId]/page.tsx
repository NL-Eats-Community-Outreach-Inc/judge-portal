import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { teams, criteria, events, eventJudges } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { authServer } from '@/lib/auth';
import { TeamScoringInterface } from './components/team-scoring-interface';

interface TeamPageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { teamId } = await params;
  const user = await authServer.requireAuth();

  // Get currently active event
  const currentEvent = await db.select().from(events).where(eq(events.status, 'active')).limit(1);

  if (!currentEvent.length) {
    redirect('/judge');
  }

  const eventId = currentEvent[0].id;

  // Check if judge is assigned to this event
  const assignment = await db
    .select()
    .from(eventJudges)
    .where(and(eq(eventJudges.eventId, eventId), eq(eventJudges.judgeId, user.id)))
    .limit(1);

  if (!assignment.length) {
    redirect('/judge');
  }

  // Get team details
  const team = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.eventId, eventId)))
    .limit(1);

  if (!team.length) {
    notFound();
  }

  // Get criteria for this event based on team's award type
  const teamData = team[0];
  let criteriaFilter;

  if (teamData.awardType === 'technical') {
    criteriaFilter = and(eq(criteria.eventId, eventId), eq(criteria.category, 'technical'));
  } else if (teamData.awardType === 'business') {
    criteriaFilter = and(eq(criteria.eventId, eventId), eq(criteria.category, 'business'));
  } else {
    // 'both' - show all criteria
    criteriaFilter = eq(criteria.eventId, eventId);
  }

  const eventCriteria = await db
    .select()
    .from(criteria)
    .where(criteriaFilter)
    .orderBy(asc(criteria.displayOrder));

  return (
    <TeamScoringInterface
      team={teamData}
      criteria={eventCriteria}
      judgeId={user.id}
      eventId={eventId}
    />
  );
}
