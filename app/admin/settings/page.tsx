import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordChangeForm } from '@/components/settings/password-change-form';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { User, Mail, Shield, Calendar } from 'lucide-react';

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/auth/login');
  }

  // Get user details from database
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // Format date
  const joinDate = userData?.created_at
    ? new Date(userData.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details and role</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">User ID</p>
                  <p className="text-sm text-muted-foreground font-mono">{user.id}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Role</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {userData?.role || 'Admin'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Member Since</p>
                  <p className="text-sm text-muted-foreground">{joinDate}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Management */}
        <PasswordChangeForm />
      </div>
    </div>
  );
}
