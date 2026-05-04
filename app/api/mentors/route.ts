import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { mentorProfiles } from '@/lib/db/schema';
import { getLearnworldsCorsHeaders } from '@/lib/api/cors';

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getLearnworldsCorsHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getLearnworldsCorsHeaders(request);

  try {
    const mentors = await db
      .select({
        id: mentorProfiles.id,
        fullName: mentorProfiles.fullName,
        title: mentorProfiles.title,
        organization: mentorProfiles.organization,
        bio: mentorProfiles.bio,
        photoUrl: mentorProfiles.photoUrl,
        tags: mentorProfiles.tags,
        linkedinUrl: mentorProfiles.linkedinUrl,
        calendlyUrl: mentorProfiles.calendlyUrl,
      })
      .from(mentorProfiles)
      .where(eq(mentorProfiles.isVisible, true));

    return NextResponse.json({ mentors }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching mentors:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
