import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MentorOnboardingForm } from '@/components/mentor-onboarding-form';

export default async function MentorOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-64px)] py-10">
      <MentorOnboardingForm />
    </div>
  );
}
