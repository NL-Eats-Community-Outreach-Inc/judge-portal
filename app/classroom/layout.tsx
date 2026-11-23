import { authServer } from '@/lib/auth';
import { redirect } from 'next/navigation';

/** Shared authenticated boundary for classroom routes. */
export default async function ClassroomLayout({ children }: { children: React.ReactNode }) {
  const user = await authServer.requireAnyRole(['learner', 'teacher']);

  if (!user) redirect('/auth/login');
  if (user.role !== 'learner' && user.role !== 'teacher') redirect('/');

  return children;
}
