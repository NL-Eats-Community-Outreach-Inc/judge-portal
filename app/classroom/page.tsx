import { authServer } from '@/lib/auth';
import { redirect } from 'next/navigation';

/** Send users to the classroom experience matching their verified role. */
export default async function ClassroomPage() {
  const user = await authServer.requireAnyRole(['learner', 'teacher']);
  if (!user) redirect('/auth/login');

  if (user.role === 'teacher') redirect('/classroom/teacher');
  if (user.role === 'learner') redirect('/classroom/learner');

  redirect('/');
}
