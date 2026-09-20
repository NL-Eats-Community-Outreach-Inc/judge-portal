'use client';

import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { EMAIL_FEATURES_ENABLED } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordlessLogin } from '@/components/auth/passwordless-login';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ROLE_HOME: Record<string, string> = {
  super_admin: '/super-admin',
  admin: '/admin',
  judge: '/judge',
  participant: '/participant',
};

/**
 * Only relative deep links into the participant area or an invitation link are
 * honoured after login, so `next` can never send someone to another site.
 */
function safeNextUrl(role: string | undefined): string | null {
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  if (next.startsWith('/invite/')) return next;
  if (role === 'participant' && next.startsWith('/participant')) return next;
  return null;
}

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Get user role from database to determine redirect
      const { data: roleData, error: roleError } = await supabase.rpc('check_user_role', {
        user_id: data.user.id,
      });

      if (roleError) {
        console.error('Error checking user role:', roleError);
        router.push('/'); // Let middleware handle the redirect
        return;
      }

      const userRole = roleData?.[0]?.role as string | undefined;
      router.push(safeNextUrl(userRole) ?? ROLE_HOME[userRole ?? ''] ?? '/');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordForm = (
    <form onSubmit={handleLogin}>
      <div className="flex flex-col gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            {EMAIL_FEATURES_ENABLED && (
              <Link
                href="/auth/forgot-password"
                className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
              >
                Forgot your password?
              </Link>
            )}
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </Button>
      </div>
    </form>
  );

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            {EMAIL_FEATURES_ENABLED
              ? 'Choose your preferred login method'
              : 'Enter your email and password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {EMAIL_FEATURES_ENABLED ? (
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="passwordless">Passwordless</TabsTrigger>
              </TabsList>
              <TabsContent value="password">{passwordForm}</TabsContent>
              <TabsContent value="passwordless">
                <PasswordlessLogin />
              </TabsContent>
            </Tabs>
          ) : (
            passwordForm
          )}

          <div className="mt-6 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/auth/sign-up" className="underline underline-offset-4">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
