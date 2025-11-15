'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OTPInput } from '@/components/auth/otp-input';
import { Loader2, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function PasswordlessLogin() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const router = useRouter();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // Only existing users
        },
      });

      if (error) {
        if (
          error.message.includes('User not found') ||
          error.message.includes('Signups not allowed')
        ) {
          toast.error('Account not found', {
            description: 'Please check your invitation email or contact an admin.',
          });
        } else {
          toast.error('Failed to send verification code', {
            description: error.message,
          });
        }
      } else {
        setStep('otp');
        toast.success('Check your email!', {
          description: 'We sent you a 6-digit verification code.',
        });
      }
    } catch (error) {
      toast.error('Something went wrong', {
        description: 'Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast.error('Invalid code', {
        description: 'Please enter all 6 digits',
      });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error || !data.user) {
        toast.error('Invalid or expired code', {
          description: 'Please check the code and try again.',
        });
      } else {
        toast.success('Login successful!', {
          description: 'Redirecting to your dashboard...',
        });

        // Get user role and redirect to appropriate dashboard
        const { data: roleData, error: roleError } = await supabase.rpc('check_user_role', {
          user_id: data.user.id,
        });

        if (roleError) {
          console.error('Error checking user role:', roleError);
          router.push('/'); // Let middleware handle the redirect
        } else {
          const userRole = roleData?.[0]?.role;
          if (userRole === 'admin') {
            router.push('/admin');
          } else if (userRole === 'judge') {
            router.push('/judge');
          } else if (userRole === 'participant') {
            router.push('/participant');
          } else {
            router.push('/'); // Let middleware handle the redirect
          }
        }
      }
    } catch (error) {
      toast.error('Verification failed', {
        description: 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <h3 className="font-semibold text-green-900 dark:text-green-100">Check your email</h3>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            We sent a 6-digit verification code to <strong>{email}</strong>
          </p>
        </div>

        {/* OTP Form */}
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Enter Verification Code</Label>
            <OTPInput value={otp} onChange={setOtp} />
            <p className="text-xs text-muted-foreground">The code will expire in 1 hour</p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Verifying...' : 'Verify & Login'}
          </Button>
        </form>

        {/* Back Button */}
        <Button
          variant="outline"
          onClick={() => {
            setStep('email');
            setOtp('');
          }}
          className="w-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Use a different email
        </Button>

        {/* Resend Button */}
        <div className="text-center">
          <Button
            variant="link"
            onClick={() => {
              setOtp('');
              handleSendOtp({ preventDefault: () => {} } as React.FormEvent);
            }}
            disabled={isLoading}
            className="text-sm"
          >
            Didn&apos;t receive the code? Resend
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          💡 For returning users: We&apos;ll send a 6-digit code to your email
        </p>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSendOtp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="email"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? 'Sending...' : 'Send Verification Code'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          We&apos;ll send you a 6-digit code to sign in without a password
        </p>
      </form>
    </div>
  );
}
