'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, Calendar, User, Building2, Shield, UserCheck, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

interface InvitationInfo {
  email: string;
  role: string;
  customMessage?: string;
  organizationName?: string | null;
}

const ROLE_CONFIG: Record<string, { title: string; label: string; description: string; afterReg: string; icon: typeof User }> = {
  admin: {
    title: "You've Been Invited as an Admin!",
    label: 'Admin Account',
    description: "You've been invited to manage an organization. No password required!",
    afterReg: 'You will have access to manage events and teams for your organization',
    icon: Shield,
  },
  judge: {
    title: "You've Been Invited as a Judge!",
    label: 'Judge Account',
    description: "You've been invited to join as a judge. No password required!",
    afterReg: 'An admin will assign you to events once your account is created',
    icon: UserCheck,
  },
  participant: {
    title: "You've Been Invited as a Participant!",
    label: 'Participant Account',
    description: "You've been invited to join as a participant. No password required!",
    afterReg: 'You can browse and register for events once your account is created',
    icon: GraduationCap,
  },
};

export default function InviteLandingPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setIsLoadingInfo(false);
      return;
    }

    // Fetch invitation info to display role-appropriate content
    const fetchInfo = async () => {
      try {
        const response = await fetch(`/api/invite/validate?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Invalid invitation');
          return;
        }

        setInvitationInfo(data.invitation);
      } catch {
        setError('Failed to load invitation details');
      } finally {
        setIsLoadingInfo(false);
      }
    };

    fetchInfo();
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
    } catch {
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
              This invitation link may have expired or been revoked. Please contact your
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

  if (isLoadingInfo) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const role = invitationInfo?.role || 'judge';
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.judge;
  const RoleIcon = config.icon;

  return (
    <div className="flex items-center justify-center h-screen px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
          <CardDescription>
            Complete your registration to access the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
              <RoleIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">{config.label}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {config.description}
                </p>
              </div>
            </div>

            {invitationInfo?.organizationName && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
                <Building2 className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Organization</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You&apos;ll be assigned to <strong>{invitationInfo.organizationName}</strong>
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
              <Mail className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Email Verification</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We&apos;ll send a 6-digit code to verify your email address
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
              <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">After Registration</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {config.afterReg}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button className="w-full" size="lg" onClick={handleContinue} disabled={isSendingOTP}>
              {isSendingOTP && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSendingOTP ? 'Sending...' : 'Continue with Email Verification'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              We&apos;ll send a verification code to your email
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
