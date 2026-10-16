import { authServer } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LearnerLayoutClient } from './components/learner-layout-client';

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const user = await authServer.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  if (user.role !== 'learner') {
    redirect('/');
  }

  return <LearnerLayoutClient user={user}>{children}</LearnerLayoutClient>;
}
