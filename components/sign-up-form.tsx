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
import { Building2, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type UserRole = 'judge' | 'participant';
type AuthMethod = 'password' | 'passwordless';
type StepType = 'role-email' | 'organizations' | 'auth';

interface OrgOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 pt-3">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className={cn(
              'rounded-full transition-all duration-300',
              index < currentStep
                ? 'h-2 w-2 bg-primary'
                : index === currentStep
                  ? 'h-2.5 w-2.5 bg-primary ring-[3px] ring-primary/20'
                  : 'h-2 w-2 bg-muted-foreground/25'
            )}
            aria-label={`Step ${index + 1} of ${totalSteps}${index === currentStep ? ', current' : index < currentStep ? ', completed' : ''}`}
          />
          {index < totalSteps - 1 && (
            <div
              className={cn(
                'h-[1.5px] w-6 rounded-full transition-all duration-500',
                index < currentStep ? 'bg-primary' : 'bg-muted-foreground/20'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function getStepMeta(stepType: StepType): { title: string; description: string } {
  switch (stepType) {
    case 'role-email':
      return {
        title: 'Create your account',
        description: 'Select your role and enter your email',
      };
    case 'organizations':
      return {
        title: 'Select organizations',
        description: "Choose which organizations you'll judge for",
      };
    case 'auth':
      return {
        title: 'Set up sign-in',
        description: 'Choose your preferred authentication method',
      };
  }
}

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
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [availableOrgs, setAvailableOrgs] = useState<OrgOption[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const router = useRouter();

  // Step sequence based on role
  const stepSequence: StepType[] =
    role === 'judge' ? ['role-email', 'organizations', 'auth'] : ['role-email', 'auth'];
  const totalSteps = stepSequence.length;
  const currentStepType = stepSequence[currentStep];
  const stepMeta = getStepMeta(currentStepType);

  // Prefetch orgs on mount
  useEffect(() => {
    setOrgsLoading(true);
    fetch('/api/organizations/public')
      .then((res) => res.json())
      .then((data) => setAvailableOrgs(data.organizations || []))
      .catch(() => toast.error('Failed to load organizations'))
      .finally(() => setOrgsLoading(false));
  }, []);

  const handleRoleChange = (value: string) => {
    setRole(value as UserRole);
    setCurrentStep(0);
    setDirection('forward');
    setError(null);
    if (value !== 'judge') {
      setSelectedOrgIds([]);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStepType) {
      case 'role-email':
        if (!email || !email.includes('@')) {
          setError('Please enter a valid email address');
          return false;
        }
        setError(null);
        return true;
      case 'organizations':
        if (selectedOrgIds.length === 0) {
          setError('Please select at least one organization');
          return false;
        }
        setError(null);
        return true;
      case 'auth':
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < totalSteps - 1) {
      setDirection('forward');
      setCurrentStep((prev) => prev + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection('backward');
      setCurrentStep((prev) => prev - 1);
      setError(null);
    }
  };

  const toggleOrg = (orgId: string) => {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
    setError(null);
  };

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
            organization_ids: role === 'judge' ? selectedOrgIds : [],
          },
        },
      });

      if (error) throw error;

      if (data.user && data.session) {
        if (role === 'judge' && selectedOrgIds.length > 0) {
          for (const orgId of selectedOrgIds) {
            const { error: memberError } = await supabase.from('organization_members').insert({
              organization_id: orgId,
              user_id: data.user.id,
            });
            if (memberError && !memberError.message.includes('duplicate')) {
              console.error('Error creating org membership:', memberError);
            }
          }
        }

        router.push(redirectPath);
      } else {
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
            invite_pending: true,
            role: role,
            organization_ids: role === 'judge' ? selectedOrgIds : [],
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
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) throw error;

      if (data.user) {
        const roleFromMetadata = data.user.user_metadata?.role as UserRole | undefined;

        if (
          !roleFromMetadata ||
          (roleFromMetadata !== 'judge' && roleFromMetadata !== 'participant')
        ) {
          console.error('Invalid or missing role in user metadata:', roleFromMetadata);
          throw new Error('Invalid role configuration. Please try signing up again.');
        }

        const { error: insertError } = await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email,
          role: roleFromMetadata,
        });

        if (insertError && !insertError.message.includes('duplicate')) {
          console.error('Error creating user record:', insertError);
          throw new Error('Failed to complete account setup');
        }

        if (roleFromMetadata === 'judge' && selectedOrgIds.length > 0) {
          for (const orgId of selectedOrgIds) {
            const { error: memberError } = await supabase.from('organization_members').insert({
              organization_id: orgId,
              user_id: data.user.id,
            });
            if (memberError && !memberError.message.includes('duplicate')) {
              console.error('Error creating org membership:', memberError);
            }
          }
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
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">{stepMeta.title}</CardTitle>
          <CardDescription>{stepMeta.description}</CardDescription>
          <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
        </CardHeader>
        <CardContent>
          {/* Animated step content */}
          <div className="relative overflow-hidden">
            <div
              key={`${currentStep}-${currentStepType}`}
              className={cn(
                'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300',
                direction === 'forward'
                  ? 'motion-safe:slide-in-from-right-4'
                  : 'motion-safe:slide-in-from-left-4'
              )}
              aria-live="polite"
            >
              {/* Step 1: Role + Email */}
              {currentStepType === 'role-email' && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label>I am registering as a</Label>
                    <RadioGroup value={role} onValueChange={handleRoleChange}>
                      <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer">
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
                      <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer">
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

                  <div className="grid gap-2">
                    <Label htmlFor="email-step1">Email</Label>
                    <Input
                      id="email-step1"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                    />
                  </div>

                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
              )}

              {/* Step 2: Organization Selection (judges only) */}
              {currentStepType === 'organizations' && (
                <div className="space-y-4">
                  {orgsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-lg border p-4 animate-pulse">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted" />
                            <div className="flex-1 space-y-2">
                              <div className="h-4 w-28 rounded bg-muted" />
                              <div className="h-3 w-full rounded bg-muted" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : availableOrgs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">No organizations available</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Please contact an administrator
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto">
                      {availableOrgs.map((org) => {
                        const isSelected = selectedOrgIds.includes(org.id);
                        return (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => toggleOrg(org.id)}
                            aria-pressed={isSelected}
                            className={cn(
                              'relative w-full text-left rounded-lg border p-3.5 transition-all duration-200',
                              'hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isSelected
                                ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                                : 'border-border hover:border-primary/40 hover:bg-muted/30'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
                                  isSelected
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                <Building2 className="h-4.5 w-4.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{org.name}</p>
                                {org.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {org.description}
                                  </p>
                                )}
                              </div>
                              <div
                                className={cn(
                                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground scale-100'
                                    : 'border-2 border-muted-foreground/25 scale-90'
                                )}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedOrgIds.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      {selectedOrgIds.length} organization
                      {selectedOrgIds.length !== 1 ? 's' : ''} selected
                    </p>
                  )}

                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
              )}

              {/* Step 3: Authentication Method */}
              {currentStepType === 'auth' && (
                <div className="space-y-4">
                  {/* Email display */}
                  <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Signing up as</p>
                    <p className="text-sm font-medium truncate">{email}</p>
                  </div>

                  <Tabs
                    value={authMethod}
                    onValueChange={(value) => setAuthMethod(value as AuthMethod)}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="password">Password</TabsTrigger>
                      <TabsTrigger value="passwordless">Passwordless</TabsTrigger>
                    </TabsList>

                    {/* Password Registration */}
                    <TabsContent value="password">
                      <form onSubmit={handlePasswordSignUp} className="space-y-4">
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
                          {isLoading ? 'Creating account...' : 'Create account'}
                        </Button>
                      </form>
                    </TabsContent>

                    {/* Passwordless Registration */}
                    <TabsContent value="passwordless">
                      {!otpSent ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                          <p className="text-xs text-muted-foreground">
                            We&apos;ll send a 6-digit verification code to{' '}
                            <span className="font-medium text-foreground">{email}</span>
                          </p>
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
                            <Button
                              type="submit"
                              className="w-full"
                              disabled={isLoading || otp.length !== 6}
                            >
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
                                setCurrentStep(0);
                                setDirection('backward');
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
              )}
            </div>
          </div>

          {/* Navigation footer */}
          {currentStepType !== 'auth' && (
            <div className="flex items-center justify-between pt-5">
              {currentStep > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : (
                <div />
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                className="gap-1"
                disabled={
                  currentStepType === 'organizations' && availableOrgs.length === 0 && !orgsLoading
                }
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Back button on auth step (above submit buttons) */}
          {currentStepType === 'auth' && (
            <div className="pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          )}

          <div className="mt-5 text-center text-sm">
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
