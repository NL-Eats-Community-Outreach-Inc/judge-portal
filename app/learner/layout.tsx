import { authServer } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LearnerLayoutClient } from './components/learner-layout-client';

/**
 * Learner Layout — Server-Side Route Guard
 *
 * Protects the learner section and provides the shared learner interface.
 *
 * This layout:
 * 1. Retrieves the authenticated user on the server.
 * 2. Redirects unauthenticated users to the login page.
 * 3. Redirects users without the learner role away from the learner section.
 * 4. Renders the shared learner layout around the current page.
 *
 * Authentication and role checks run on the server before learner pages render.
 */

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  // 1. Retrieve the current authenticated user on the server.
  const user = await authServer.getUser();

  // 2. Redirect unauthenticated users to login.
  if (!user) {
    redirect('/auth/login');
  }

  // 3. Restrict this route tree to users with the learner role.
  if (user.role !== 'learner') {
    redirect('/');
  }

  // 4. Render the shared learner interface around the authorized page.
  return <LearnerLayoutClient user={user}>{children}</LearnerLayoutClient>;
}
