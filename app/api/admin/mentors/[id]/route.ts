import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { mentorProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isValidUuid } from '@/app/api/challenges/utils';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid mentor id' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 });
    }

    // Guard null (typeof null === 'object') and arrays before destructuring.
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { isVisible } = body as { isVisible?: unknown };

    if (typeof isVisible !== 'boolean') {
      return NextResponse.json(
        { error: 'Field "isVisible" is required and must be a boolean' },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(mentorProfiles)
      .set({ isVisible })
      .where(eq(mentorProfiles.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
    }

    return NextResponse.json({ mentor: updated });
  } catch (error) {
    console.error('Error updating mentor profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
