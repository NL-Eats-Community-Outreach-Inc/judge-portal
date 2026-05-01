import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { competitions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireCompetitionInOrg } from '@/lib/auth/org';
import { sendApiError } from '@/lib/utils/api-errors';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ competitionId: string }> }
) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { competitionId } = await params;

    await requireCompetitionInOrg(competitionId, orgId);

    const body = await request.json();

    // Build the update object from fields present in the request body.
    // Using 'key in body' allows explicit null values (to clear a field)
    // while omitting fields that weren't sent (partial update)
    const updateData: Record<string, unknown> = {};
    const fields = [
      'title',
      'shortDescription',
      'coverImageUrl',
      'challengeType',
      'tags',
      'prize',
      'deadline',
      'country',
      'participantSignupUrl',
    ] as const;
    for (const field of fields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db
      .update(competitions)
      .set(updateData)
      .where(eq(competitions.id, competitionId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating competition:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ competitionId: string }> }
) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { competitionId } = await params;

    await requireCompetitionInOrg(competitionId, orgId);

    await db.delete(competitions).where(eq(competitions.id, competitionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting competition', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}