import { redirect } from 'next/navigation';
import { getUserFromSession } from '@/lib/auth/server';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Get user session and role
  const user = await getUserFromSession();

  // Redirect if not authenticated or not an admin
  if (!user || user.role !== 'admin') {
    redirect('/auth/login');
  }

  // Guard for orphaned admins (org deleted, organizationId = null)
  if (!user.organizationId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8 space-y-4">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-amber-600 dark:text-amber-400"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Organization Removed</h1>
          <p className="text-muted-foreground">
            Your organization has been removed. Contact a super admin to be reassigned to an
            organization.
          </p>
          <form
            action={async () => {
              'use server';
              const supabase = await createClient();
              await supabase.auth.signOut();
              redirect('/auth/login');
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
