'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OTPInput } from '@/components/auth/otp-input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, ApiError, messageOf } from '@/lib/api/client';

/**
 * OTP entry for the email-based invitation flow. Only rendered while
 * EMAIL_FEATURES_ENABLED is on; the page redirects to the password form otherwise.
 */
export function InviteVerifyForm({ token }: { token: string }) {
  const router = useRouter();

  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter all 6 digits');
      return;
    }

    setIsVerifying(true);

    try {
      const data = await apiFetch<{ redirectUrl?: string }>('/api/invite/verify', {
        method: 'POST',
        body: { token, otp },
      });

      toast.success('Welcome!', {
        description: 'Your account has been created successfully',
      });

      router.push(data.redirectUrl || '/');
    } catch (error) {
      // An existing account is sent to its own dashboard after the message
      const redirectUrl = error instanceof ApiError ? error.data.redirectUrl : undefined;
      if (typeof redirectUrl === 'string') {
        toast.error('Account Already Exists', {
          description: messageOf(error, 'You already have an account'),
          duration: 6000,
        });
        setTimeout(() => router.push(redirectUrl), 2000);
        return;
      }
      toast.error('Verification failed', {
        description: messageOf(error, 'Invalid or expired code'),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);

    try {
      const data = await apiFetch<{ invitation: { email: string } }>('/api/invite/validate', {
        method: 'POST',
        body: { token },
      });

      toast.success('Code sent!', {
        description: `Check ${data.invitation.email} for a new code`,
      });

      setOtp('');
    } catch (error) {
      toast.error('Failed to resend code', { description: messageOf(error) });
    } finally {
      setIsResending(false);
    }
  };

  const handleOTPComplete = (value: string) => {
    setOtp(value);
    // Auto-verify when all digits entered
    if (value.length === 6) {
      handleVerify();
    }
  };

  return (
    <div className="flex items-center justify-center h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>Enter the 6-digit code we sent to your email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <OTPInput
              length={6}
              value={otp}
              onChange={setOtp}
              onComplete={handleOTPComplete}
              disabled={isVerifying}
            />
          </div>

          <div className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={handleVerify}
              disabled={isVerifying || otp.length !== 6}
            >
              {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isVerifying ? 'Verifying...' : 'Verify and Continue'}
            </Button>

            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={handleResend} disabled={isResending}>
                {isResending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {isResending ? 'Sending...' : 'Didn\u0027t receive a code? Resend'}
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            The code expires in 1 hour. Check your spam folder if you don&apos;t see it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
