import { authServer } from '@/lib/auth';
import { redirect } from 'next/navigation';

import { ClassroomLayoutClient } from '../components/shared/classroom-layout-client';

/** Teacher-only route guard. */
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await authServer.requireAnyRole(['teacher']);
  if (!user) redirect('/auth/login');
  if (user.role !== 'teacher') redirect('/classroom');

  return (
    <ClassroomLayoutClient user={user} role="teacher">
      {children}
    </ClassroomLayoutClient>
  );
}
