import { redirect } from 'next/navigation';
import { getUserFromSession } from '@/lib/auth/server';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromSession();

  if (!user || user.role !== 'super_admin') {
    redirect('/auth/login');
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
