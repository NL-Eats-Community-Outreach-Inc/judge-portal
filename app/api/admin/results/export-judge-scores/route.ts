import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { scores, teams, criteria, users, events, eventJudges } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Get all scores with judge, team, and criterion details
    // Filter scores by team award type vs criteria category (same filtering as main results API)
    // Only include scores from assigned judges
    const allScores = await db
      .select({
        score: scores.score,
        teamId: teams.id,
        teamName: teams.name,
        teamPresentationOrder: teams.presentationOrder,
        teamAwardType: teams.awardType,
        judgeId: users.id,
        judgeEmail: users.email,
        criterionId: criteria.id,
        criterionName: criteria.name,
        criterionDisplayOrder: criteria.displayOrder,
        criterionCategory: criteria.category,
        criterionMaxScore: criteria.maxScore,
      })
      .from(scores)
      .innerJoin(teams, eq(scores.teamId, teams.id))
      .innerJoin(criteria, eq(scores.criterionId, criteria.id))
      .innerJoin(users, eq(scores.judgeId, users.id))
      .innerJoin(
        eventJudges,
        sql`${eventJudges.judgeId} = ${users.id} AND ${eventJudges.eventId} = ${teams.eventId}`
      ).where(sql`${teams.eventId} = ${eventId} AND (
        (${teams.awardType} = 'technical' AND ${criteria.category} = 'technical') OR
        (${teams.awardType} = 'business' AND ${criteria.category} = 'business') OR
        (${teams.awardType} = 'both')
      )`);

    // Get all teams, judges, and criteria for the event to build the matrix structure
    const allTeams = await db
      .select({
        id: teams.id,
        name: teams.name,
        presentationOrder: teams.presentationOrder,
        awardType: teams.awardType,
      })
      .from(teams)
      .where(eq(teams.eventId, eventId))
      .orderBy(teams.presentationOrder);

    const allJudges = await db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .innerJoin(eventJudges, sql`${eventJudges.judgeId} = ${users.id}`)
      .where(eq(eventJudges.eventId, eventId))
      .orderBy(users.email);

    const allCriteria = await db
      .select({
        id: criteria.id,
        name: criteria.name,
        displayOrder: criteria.displayOrder,
        maxScore: criteria.maxScore,
        category: criteria.category,
      })
      .from(criteria)
      .where(eq(criteria.eventId, eventId))
      .orderBy(criteria.displayOrder);

    // Build score matrix
    const scoreMatrix: Record<string, Record<string, Record<string, number | null>>> = {};

    // Initialize matrix
    allTeams.forEach((team) => {
      scoreMatrix[team.id] = {};
      allJudges.forEach((judge) => {
        scoreMatrix[team.id][judge.id] = {};
        allCriteria.forEach((criterion) => {
          scoreMatrix[team.id][judge.id][criterion.id] = null;
        });
      });
    });

    // Populate matrix with actual scores
    allScores.forEach((score) => {
      if (
        scoreMatrix[score.teamId] &&
        scoreMatrix[score.teamId][score.judgeId] &&
        scoreMatrix[score.teamId][score.judgeId][score.criterionId] !== undefined
      ) {
        scoreMatrix[score.teamId][score.judgeId][score.criterionId] = score.score;
      }
    });

    // Helper function to escape CSV fields
    const escapeCSV = (value: string | number | null): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Helper function to get criteria for a specific team based on award type
    const getCriteriaForTeam = (teamAwardType: 'technical' | 'business' | 'both') => {
      return allCriteria.filter((criterion) => {
        if (teamAwardType === 'both') return true;
        return criterion.category === teamAwardType;
      });
    };

    // Create CSV content in matrix format
    let csvContent = '';

    // Helper function to format award type for better readability
    const formatAwardType = (type: 'technical' | 'business' | 'both') => {
      if (type === 'both') return 'General';
      return type.charAt(0).toUpperCase() + type.slice(1);
    };

    // First header row: Team info columns, then judge names repeated for each criterion
    const headerRow1 = ['Team Name', 'Presentation Order', 'Award Type'];
    allJudges.forEach((judge) => {
      allCriteria.forEach(() => {
        headerRow1.push(escapeCSV(judge.email.split('@')[0]));
      });
    });
    csvContent += headerRow1.join(',') + '\n';

    // Second header row: Empty team columns, then criterion names under each judge
    const headerRow2 = ['', '', ''];
    allJudges.forEach(() => {
      allCriteria.forEach((criterion) => {
        headerRow2.push(escapeCSV(`${criterion.name} (/${criterion.maxScore})`));
      });
    });
    csvContent += headerRow2.join(',') + '\n';

    // Data rows: One row per team with scores
    allTeams.forEach((team) => {
      const teamCriteria = getCriteriaForTeam(team.awardType);
      const teamCriteriaIds = new Set(teamCriteria.map((c) => c.id));

      const row = [escapeCSV(team.name), team.presentationOrder, formatAwardType(team.awardType)];

      allJudges.forEach((judge) => {
        allCriteria.forEach((criterion) => {
          const isRelevantCriteria = teamCriteriaIds.has(criterion.id);
          const score = scoreMatrix[team.id][judge.id][criterion.id];

          if (!isRelevantCriteria) {
            row.push('N/A');
          } else if (score !== null) {
            row.push(String(score));
          } else {
            row.push('');
          }
        });
      });

      csvContent += row.join(',') + '\n';
    });

    // Get event name for filename
    const eventResult = await db
      .select({ name: events.name })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    const eventName = eventResult[0]?.name || 'event';
    const safeEventName = eventName.replace(/[^a-z0-9]/gi, '-').toLowerCase();

    // Set response headers for CSV download
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv');
    headers.set(
      'Content-Disposition',
      `attachment; filename="judge-scores-matrix-${safeEventName}-${new Date().toISOString().split('T')[0]}.csv"`
    );

    return new NextResponse(csvContent, { headers });
  } catch (error) {
    console.error('Error exporting judge scores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
