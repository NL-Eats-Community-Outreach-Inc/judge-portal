import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mentorProfiles } from '@/lib/db/schema';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const values = {
      learnworldsUserId: null, // Needs updating when learnworlds user id is fetchable
      fullName: body.cf_mentor_name,
      title: body.cf_mentor_title,
      organization: body.cf_mentor_org,
      bio: body.cf_mentor_bio,
      linkedinUrl: body.cf_mentor_linkedin,
      calendlyUrl: body.cf_mentor_calendly,
      photoUrl: body.cf_mentor_photo,
      tags: body.cf_mentor_expertise ?? [],
      isVisible: false,
    };

    await db
      .insert(mentorProfiles)
      .values(values)
      .onConflictDoUpdate({
        target: mentorProfiles.learnworldsUserId,
        set: {
          fullName: values.fullName,
          title: values.title,
          organization: values.organization,
          bio: values.bio,
          linkedinUrl: values.linkedinUrl,
          calendlyUrl: values.calendlyUrl,
          photoUrl: values.photoUrl,
          tags: values.tags,
        },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error during submission: ', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
