import { redirect } from 'next/navigation';
import { authServer } from '@/lib/auth';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await authServer.getUser();

  if (!user || user.role !== 'super_admin') {
    redirect('/auth/login');
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
