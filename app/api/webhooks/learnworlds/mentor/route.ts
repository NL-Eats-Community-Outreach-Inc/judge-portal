import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { mentorProfiles } from '@/lib/db/schema';

// LearnWorlds custom field names → mentor_profiles columns
const FIELD_MAP: Record<string, string> = {
  cf_mentor_title: 'title',
  cf_mentor_org: 'organization',
  cf_mentor_bio: 'bio',
  cf_mentor_linkedin: 'linkedinUrl',
  cf_mentor_calendly: 'calendlyUrl',
  cf_mentor_photo: 'photoUrl',
};

/**
 * POST /api/webhooks/learnworlds/mentor
 * Receives webhook from LearnWorlds when a mentor submits their application.
 * Upserts into mentor_profiles based on learnworlds_user_id.
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.LEARNWORLDS_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('LEARNWORLDS_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // LearnWorlds sends HMAC-SHA256 of the body in x-lw-signature
    const signature = request.headers.get('x-lw-signature') ?? '';
    const body = await request.text();
    const expectedSig = createHmac('sha256', webhookSecret).update(body).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    const userId = payload.user_id || payload.id;
    const fullName = payload.name || payload.full_name || 'Unknown';

    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // Map LearnWorlds custom fields to our column values
    const mapped: Record<string, string | null> = {};
    for (const [lwField, dbColumn] of Object.entries(FIELD_MAP)) {
      if (payload[lwField] !== undefined) {
        mapped[dbColumn] = payload[lwField];
      }
    }

    // Atomic upsert — insert new profile or update existing by learnworlds_user_id
    await db
      .insert(mentorProfiles)
      .values({
        learnworldsUserId: userId,
        fullName,
        title: mapped.title ?? null,
        organization: mapped.organization ?? null,
        bio: mapped.bio ?? null,
        linkedinUrl: mapped.linkedinUrl ?? null,
        calendlyUrl: mapped.calendlyUrl ?? null,
        photoUrl: mapped.photoUrl ?? null,
        isVisible: false,
      })
      .onConflictDoUpdate({
        target: mentorProfiles.learnworldsUserId,
        set: { fullName, ...mapped },
      });

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
