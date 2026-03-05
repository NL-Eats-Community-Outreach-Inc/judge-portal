import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    // malformed UUID -> 400
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Malformed UUID string.' }, { status: 400 });
    }

    // fetch a single "challenge" (event) + organization name
    const rows = await db
      .select({
        id: events.id,
        name: events.name,
        description: events.description,
        status: events.status,
        maxTeamSize: events.maxTeamSize,
        organizationId: events.organizationId,
        organizationName: organizations.name,
        createdAt: events.createdAt,
      })
      .from(events)
      .leftJoin(organizations, eq(events.organizationId, organizations.id))
      .where(eq(events.id, id))
      .limit(1);

    const challenge = rows[0];

    // non-existent OR draft ("setup") -> 404
    if (!challenge || challenge.status === 'setup') {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error('Error fetching challenge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
