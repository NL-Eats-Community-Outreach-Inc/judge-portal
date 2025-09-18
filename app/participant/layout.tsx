import { redirect } from 'next/navigation';
import { getUserFromSession } from '@/lib/auth/server';

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  // Get user session and role
  const user = await getUserFromSession();

  // Redirect if not authenticated or not a participant
  if (!user || user.role !== 'participant') {
    redirect('/auth/login');
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
