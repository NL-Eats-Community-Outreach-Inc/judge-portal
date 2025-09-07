'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
export function LogoutButton() {
  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Force a hard navigation to ensure auth state is fully cleared
    window.location.href = '/';
  };

  return <Button onClick={logout}>Logout</Button>;
}
