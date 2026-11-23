import { authServer } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ClassroomLayoutClient } from '../components/shared/classroom-layout-client';

/** Learner-only route guard and learner navigation shell. */
export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const user = await authServer.requireAnyRole(['learner']);
  if (!user) redirect('/auth/login');
  if (user.role !== 'learner') redirect('/classroom');

  return (
    <ClassroomLayoutClient user={user} role="learner">
      {children}
    </ClassroomLayoutClient>
  );
}
