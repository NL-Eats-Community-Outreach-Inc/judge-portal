import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { csvRow, csvAttachment } from '@/lib/utils/csv';
import { loadCountedScores } from '@/lib/db/results';
import { formatAwardType } from '@/lib/results';

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return sendApiError(400, 'BAD_REQUEST', 'Event ID is required');
    }

    await requireEventInOrg(eventId, orgId);

    // Counted rows only (assigned judges, applicable criteria), comment or not,
    // so the file lists exactly the scores the rankings are built from
    const [allScores, eventResult] = await Promise.all([
      loadCountedScores(eventId),
      db.select({ name: events.name }).from(events).where(eq(events.id, eventId)).limit(1),
    ]);

    const rows = [...allScores].sort(
      (a, b) =>
        a.team.presentationOrder - b.team.presentationOrder ||
        a.judge.email.localeCompare(b.judge.email) ||
        a.criterion.displayOrder - b.criterion.displayOrder
    );

    const lines = [
      'Presentation Order,Team,Award Type,Judge,Criterion,Score,Comment',
      ...rows.map((row) =>
        csvRow([
          row.team.presentationOrder,
          row.team.name,
          formatAwardType(row.team.awardType),
          row.judge.email,
          row.criterion.name,
          row.score,
          row.comment ?? '',
        ])
      ),
    ];
    const csvContent = lines.join('\n') + '\n';

    const eventName = eventResult[0]?.name || 'event';

    const headers = new Headers();
    headers.set('Content-Type', 'text/csv');
    headers.set('Content-Disposition', csvAttachment('judging-comments', eventName));

    return new NextResponse(csvContent, { headers });
  } catch (error) {
    return handleRouteError(error, 'Error exporting comments');
  }
}
