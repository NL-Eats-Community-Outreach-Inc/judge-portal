'use client';

import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordlessLogin } from '@/components/auth/passwordless-login';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getLearnWorldsParams, getPostAuthRedirect } from '@/lib/utils/learnworlds-params';

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signUpHref, setSignUpHref] = useState('/auth/sign-up');
  const router = useRouter();

  // Pre-fill email from LearnWorlds params and preserve next param for sign-up link
  useEffect(() => {
    const params = getLearnWorldsParams();
    if (params.isLearnWorlds && params.email) {
      setEmail(params.email);
    }
    if (params.nextUrl) {
      setSignUpHref(`/auth/sign-up?next=${encodeURIComponent(params.nextUrl)}`);
    }
  }, []);

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
        router.push('/');
      } else {
        const userRole = roleData?.[0]?.role;
        router.push(getPostAuthRedirect(userRole));
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Choose your preferred login method</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="passwordless">Passwordless</TabsTrigger>
            </TabsList>

            {/* Password Login Tab */}
            <TabsContent value="password">
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
                      <Link
                        href="/auth/forgot-password"
                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                      >
                        Forgot your password?
                      </Link>
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
            </TabsContent>

            {/* Passwordless Login Tab */}
            <TabsContent value="passwordless">
              <PasswordlessLogin />
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href={signUpHref} className="underline underline-offset-4">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
