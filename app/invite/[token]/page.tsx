'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';

export default function InviteLandingPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
    }
  }, [token]);

  const handleContinue = async () => {
    setIsSendingOTP(true);

    try {
      const response = await fetch('/api/invite/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to validate invitation');
        toast.error('Validation failed', {
          description: data.error || 'Please contact your administrator',
        });
        return;
      }

      toast.success('Check your email!', {
        description: `We sent a verification code to ${data.invitation.email}`,
      });

      // Redirect to verification page
      router.push(`/invite/${token}/verify`);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      toast.error('Failed to send verification code');
    } finally {
      setIsSendingOTP(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This invitation link may have expired or been revoked. Please contact the event
              administrator for a new invitation.
            </p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>You've Been Invited!</CardTitle>
          <CardDescription>
            You've been invited to participate in an upcoming event
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Event Details</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You'll get more information after verifying your email
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
                  <User className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Your Role</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You've been invited as a judge for this event
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
                  <Mail className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Next Step</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click continue to verify your email address
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleContinue}
                  disabled={isSendingOTP}
                >
                  {isSendingOTP && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSendingOTP ? 'Sending...' : 'Continue with Email Verification'}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  We'll send a verification code to your email
                </p>
              </div>
        </CardContent>
      </Card>
    </div>
  );
}
