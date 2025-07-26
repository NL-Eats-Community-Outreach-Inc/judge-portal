import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { teams, criteria, events } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { authServer } from '@/lib/auth'
import { TeamScoringInterface } from './components/team-scoring-interface'

interface TeamPageProps {
  params: Promise<{
    teamId: string
  }>
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { teamId } = await params
  const user = await authServer.requireAuth()
  
  // Get currently active event
  const currentEvent = await db.select()
    .from(events)
    .where(eq(events.status, 'active'))
    .limit(1)

  if (!currentEvent.length) {
    redirect('/judge')
  }

  const eventId = currentEvent[0].id

  // Get team details
  const team = await db.select()
    .from(teams)
    .where(
      and(
        eq(teams.id, teamId),
        eq(teams.eventId, eventId)
      )
    )
    .limit(1)

  if (!team.length) {
    redirect('/judge')
  }

  // Get all criteria for this event
  const eventCriteria = await db.select()
    .from(criteria)
    .where(eq(criteria.eventId, eventId))
    .orderBy(asc(criteria.displayOrder))

  return (
    <div className="p-6">
      <TeamScoringInterface 
        team={team[0]}
        criteria={eventCriteria}
        judgeId={user.id}
        eventId={eventId}
      />
    </div>
  )
}