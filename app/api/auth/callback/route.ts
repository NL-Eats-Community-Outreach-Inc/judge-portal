import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { completeSignup, SIGNUP_ROLES } from '@/lib/auth/complete-signup';

function isSafeNextPath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next') ?? '/judge';
  const next = isSafeNextPath(requestedNext) ? requestedNext : '/judge';

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  try {
    const metadata = data.user.user_metadata ?? {};
    const metadataRoles = Array.isArray(metadata.roles) ? metadata.roles : [metadata.role];

    const hasPublicSignupRole = metadataRoles.some(
      (role: unknown) =>
        typeof role === 'string' && (SIGNUP_ROLES as readonly string[]).includes(role)
    );

    if (hasPublicSignupRole && data.user.email) {
      await completeSignup(data.user.id, data.user.email, metadata);
    }
  } catch (error) {
    console.error('Error completing signup:', error);
    return NextResponse.redirect(`${origin}/auth/error`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
