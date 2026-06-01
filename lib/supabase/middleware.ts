import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasEnvVars } from '../utils';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip middleware check.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const pathname = request.nextUrl.pathname;
  console.log('Middleware: Processing path:', pathname, 'User authenticated:', !!user);

  // Handle unauthenticated users
  if (!user) {
    // Allow access to auth pages, root, invite pages, and public API endpoints
    if (
      pathname === '/' ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/invite') ||
      pathname.startsWith('/api/invite') ||
      pathname.startsWith('/api/organizations/public') ||
      pathname.startsWith('/api/webhooks')
    ) {
      return supabaseResponse;
    }
    if (pathname.startsWith('/api/admin/mentors')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Redirect to login for protected routes
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    // Preserve query params for participant routes (for demo deep linking)
    if (pathname.startsWith('/participant')) {
      const originalUrl = pathname + request.nextUrl.search;
      url.searchParams.set('next', originalUrl);
    }
    return NextResponse.redirect(url);
  }

  // Handle authenticated users - get their role
  try {
    console.log('Middleware: Looking for user with ID:', user.sub);

    let userRole;
    let selectError = null;

    // Use database function to check user role (bypasses RLS)
    try {
      const { data: roleData, error: dbError } = await supabase.rpc('check_user_role', {
        user_id: user.sub,
      });

      if (dbError) {
        throw dbError;
      }

      // Function returns array with single result or empty array
      userRole = roleData?.[0]?.role;
    } catch (dbError) {
      console.error('Middleware: Database error:', dbError);
      selectError = dbError;
    }

    // If user doesn't exist in database, redirect to signup
    if (!userRole && !selectError) {
      console.log('Middleware: User not found in database, redirecting to signup');
      const url = request.nextUrl.clone();
      url.pathname = '/auth/sign-up';
      return NextResponse.redirect(url);
    }

    // Handle database errors
    if (selectError) {
      console.error('Middleware: Database error:', selectError);
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }

    // Role-based routing - user should exist at this point
    const role = userRole;
    console.log('Middleware: User role:', role, 'Path:', pathname);

    // Root path - redirect based on role
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      if (role === 'super_admin') {
        url.pathname = '/super-admin';
      } else if (role === 'admin') {
        url.pathname = '/admin';
      } else if (role === 'participant') {
        url.pathname = '/participant';
      } else {
        url.pathname = '/judge';
      }
      console.log('Middleware: Redirecting from root to:', url.pathname);
      return NextResponse.redirect(url);
    }

    // Super admin routes - only super_admin can access
    if (pathname.startsWith('/super-admin')) {
      if (role !== 'super_admin') {
        console.log(
          'Middleware: Non-super_admin trying to access super-admin route, redirecting based on role'
        );
        const url = request.nextUrl.clone();
        url.pathname =
          role === 'admin' ? '/admin' : role === 'participant' ? '/participant' : '/judge';
        return NextResponse.redirect(url);
      }
      console.log('Middleware: Super admin access granted to super-admin route');
      return supabaseResponse;
    }

    // Admin routes - only admins can access (super_admin CANNOT access /admin)
    if (pathname.startsWith('/admin')) {
      if (role !== 'admin') {
        console.log(
          'Middleware: Non-admin trying to access admin route, redirecting based on role'
        );
        const url = request.nextUrl.clone();
        url.pathname =
          role === 'super_admin'
            ? '/super-admin'
            : role === 'participant'
              ? '/participant'
              : '/judge';
        return NextResponse.redirect(url);
      }
      console.log('Middleware: Admin access granted to admin route');
      return supabaseResponse;
    }

    // Judge routes - only judges can access
    if (pathname.startsWith('/judge')) {
      if (role !== 'judge') {
        console.log(
          'Middleware: Non-judge trying to access judge route, redirecting based on role'
        );
        const url = request.nextUrl.clone();
        url.pathname =
          role === 'super_admin'
            ? '/super-admin'
            : role === 'admin'
              ? '/admin'
              : role === 'participant'
                ? '/participant'
                : '/';
        return NextResponse.redirect(url);
      }
      console.log('Middleware: Judge access granted to judge route');
      return supabaseResponse;
    }

    // Participant routes - only participants can access
    if (pathname.startsWith('/participant')) {
      if (role !== 'participant') {
        console.log(
          'Middleware: Non-participant trying to access participant route, redirecting based on role'
        );
        const url = request.nextUrl.clone();
        url.pathname =
          role === 'super_admin' ? '/super-admin' : role === 'admin' ? '/admin' : '/judge';
        return NextResponse.redirect(url);
      }
      console.log('Middleware: Participant access granted to participant route');
      return supabaseResponse;
    }

    // All other authenticated routes
    console.log('Middleware: Allowing access to other authenticated route');
  } catch (error) {
    console.error('Error in middleware:', error);
    // On error, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
