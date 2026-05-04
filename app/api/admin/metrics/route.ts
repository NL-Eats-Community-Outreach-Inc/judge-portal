/**
 * Admin Metrics Endpoint
 * GET /api/admin/metrics
 *
 * Returns aggregated analytics data for administrative use.
 * Access is restricted to users with the admin role.
 */

import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { users, scores, teams } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const learnerCountResult = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(users)
      .where(eq(users.role, 'participant'));

    const scoreCountResult = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(scores);

    const topTeams = await db
      .select({
        teamId: scores.teamId,
        teamName: teams.name,
        scoreCount: sql<number>`count(*)`,
      })
      .from(scores)
      .leftJoin(teams, eq(scores.teamId, teams.id))
      .groupBy(scores.teamId, teams.name)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    const metrics = {
      totalScoredSubmissions: Number(scoreCountResult[0]?.count ?? 0),
      topScoredTeams: topTeams.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName ?? 'Unknown Team',
        count: Number(team.scoreCount ?? 0),
      })),
      totalLearnersServed: Number(learnerCountResult[0]?.count ?? 0),
      averageResponseTime: null,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}