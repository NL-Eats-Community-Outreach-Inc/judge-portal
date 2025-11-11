'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OTPInput } from '@/components/auth/otp-input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InviteVerifyPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

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
      const response = await fetch('/api/invite/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Special handling for existing users
        if (data.existingRole && data.redirectUrl) {
          toast.error('Account Already Exists', {
            description: data.error || 'You already have an account',
            duration: 6000,
          });
          // Redirect to their existing dashboard after a short delay
          setTimeout(() => {
            router.push(data.redirectUrl);
          }, 2000);
          return;
        }

        toast.error('Verification failed', {
          description: data.error || 'Invalid or expired code',
        });
        return;
      }

      toast.success('Welcome!', {
        description: 'Your account has been created successfully',
      });

      // Redirect to appropriate dashboard
      router.push(data.redirectUrl);
    } catch (err) {
      toast.error('Something went wrong', {
        description: 'Please try again',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);

    try {
      const response = await fetch('/api/invite/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error('Failed to resend code', {
          description: data.error,
        });
        return;
      }

      toast.success('Code sent!', {
        description: `Check ${data.invitation.email} for a new code`,
      });

      // Clear current OTP
      setOtp('');
    } catch (err) {
      toast.error('Failed to resend code');
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
          <CardDescription>
            Enter the 6-digit code we sent to your email
          </CardDescription>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={isResending}
              >
                {isResending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {isResending ? 'Sending...' : "Didn't receive a code? Resend"}
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            The code expires in 1 hour. Check your spam folder if you don't see it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
