import { db } from '@/lib/db';
import { judgeTeamConflicts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function loadEventConflicts(eventId: string) {
  const conflicts = await db
    .select({
      teamId: judgeTeamConflicts.teamId,
      judgeId: judgeTeamConflicts.judgeId,
      hasConflict: judgeTeamConflicts.hasConflict,
    })
    .from(judgeTeamConflicts)
    .where(eq(judgeTeamConflicts.eventId, eventId));

  return new Map(
    conflicts.map((conflict) => [`${conflict.teamId}:${conflict.judgeId}`, conflict.hasConflict])
  );
}
