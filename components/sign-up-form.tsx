'use client';

import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OTPInput } from '@/components/auth/otp-input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type UserRole = 'judge' | 'participant';
type AuthMethod = 'password' | 'passwordless';

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [role, setRole] = useState<UserRole>('judge');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handlePasswordSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const redirectPath = role === 'judge' ? '/judge' : '/participant';

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${redirectPath}&role=${role}`,
          data: {
            role: role,
          },
        },
      });

      if (error) throw error;

      // Check if user is immediately confirmed (email confirmation disabled)
      if (data.user && data.session) {
        // User is auto-confirmed and logged in
        // User record is automatically created by database trigger with correct role from metadata
        router.push(redirectPath);
      } else {
        // User needs email confirmation
        router.push('/auth/sign-up-success');
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            // CRITICAL: Add flag to prevent automatic user creation by trigger
            // The trigger will skip creation until OTP is verified
            invite_pending: true,
            role: role,
          },
        },
      });

      if (error) throw error;

      setOtpSent(true);
      toast.success('Check your email for the verification code');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // Verify OTP
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) throw error;

      if (data.user) {
        // 🔒 SECURITY FIX: Read role from user metadata (server-side, cannot be tampered)
        // The role was set during signInWithOtp (line 91) and stored securely by Supabase
        const roleFromMetadata = data.user.user_metadata?.role as UserRole | undefined;

        // Validate that role exists and is valid
        if (!roleFromMetadata || (roleFromMetadata !== 'judge' && roleFromMetadata !== 'participant')) {
          console.error('Invalid or missing role in user metadata:', roleFromMetadata);
          throw new Error('Invalid role configuration. Please try signing up again.');
        }

        // Create user record in public.users table with validated role from metadata
        // The trigger was skipped due to invite_pending flag
        const { error: insertError } = await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email,
          role: roleFromMetadata, // ✅ Using server-side metadata, not client variable
        });

        // Ignore conflict errors (user already exists)
        if (insertError && !insertError.message.includes('duplicate')) {
          console.error('Error creating user record:', insertError);
          throw new Error('Failed to complete account setup');
        }

        const redirectPath = roleFromMetadata === 'judge' ? '/judge' : '/participant';
        router.push(redirectPath);
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
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>Create a new account to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Role Selection */}
            <div className="space-y-3">
              <Label>I am registering as a</Label>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="judge" id="role-judge" />
                  <Label htmlFor="role-judge" className="flex-1 cursor-pointer">
                    <div>
                      <p className="font-medium">Judge</p>
                      <p className="text-xs text-muted-foreground">
                        Score and evaluate team projects
                      </p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="participant" id="role-participant" />
                  <Label htmlFor="role-participant" className="flex-1 cursor-pointer">
                    <div>
                      <p className="font-medium">Participant</p>
                      <p className="text-xs text-muted-foreground">
                        Join events and create teams
                      </p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Authentication Method Tabs */}
            <Tabs value={authMethod} onValueChange={(value) => setAuthMethod(value as AuthMethod)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="passwordless">Passwordless</TabsTrigger>
              </TabsList>

              {/* Password Registration */}
              <TabsContent value="password">
                <form onSubmit={handlePasswordSignUp} className="space-y-4">
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
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="repeat-password">Confirm Password</Label>
                    <Input
                      id="repeat-password"
                      type="password"
                      required
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                      minLength={6}
                      placeholder="Repeat your password"
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create account with password'}
                  </Button>
                </form>
              </TabsContent>

              {/* Passwordless Registration */}
              <TabsContent value="passwordless">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email-otp">Email</Label>
                      <Input
                        id="email-otp"
                        type="email"
                        placeholder="m@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        You&apos;ll receive a 6-digit verification code via email
                      </p>
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? 'Sending code...' : 'Send verification code'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Verification Code</Label>
                      <p className="text-sm text-muted-foreground">
                        Enter the 6-digit code sent to {email}
                      </p>
                      <OTPInput value={otp} onChange={setOtp} />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <div className="space-y-2">
                      <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                        {isLoading ? 'Verifying...' : 'Verify and create account'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setOtpSent(false);
                          setOtp('');
                          setError(null);
                        }}
                      >
                        Use a different email
                      </Button>
                    </div>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-6 text-center text-sm">
            Already have an account?{' '}
            <Link href="/auth/login" className="underline underline-offset-4">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
