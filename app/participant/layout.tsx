import { authServer } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ParticipantLayoutClient } from './components/participant-layout-client';

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await authServer.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  if (user.role !== 'participant') {
    redirect('/');
  }

  return <ParticipantLayoutClient user={user}>{children}</ParticipantLayoutClient>;
}
