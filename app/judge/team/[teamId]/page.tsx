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

  // Get team and its event in one query
  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team.length) {
    notFound();
  }

  const teamData = team[0];
  const eventId = teamData.eventId;

  // Verify the team's event is active
  const teamEvent = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.status, 'active')))
    .limit(1);

  if (!teamEvent.length) {
    redirect('/judge');
  }

  // Check if judge is assigned to this event
  const assignment = await db
    .select()
    .from(eventJudges)
    .where(and(eq(eventJudges.eventId, eventId), eq(eventJudges.judgeId, user.id)))
    .limit(1);

  if (!assignment.length) {
    redirect('/judge');
  }

  // Get criteria for this event based on team's award type
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
