'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth/client';
import {
  Loader2,
  KeyRound,
  Calendar,
  User,
  Building2,
  Shield,
  UserCheck,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import { LoadingState } from '@/components/ui/loading-state';
import { apiFetch, ApiError, messageOf } from '@/lib/api/client';

interface InvitationInfo {
  email: string;
  role: string;
  customMessage?: string;
  organizationName?: string | null;
}

const MIN_PASSWORD_LENGTH = 6;

const ROLE_CONFIG: Record<
  string,
  { title: string; label: string; description: string; afterReg: string; icon: typeof User }
> = {
  admin: {
    title: "You've Been Invited as an Admin!",
    label: 'Admin Account',
    description: "You've been invited to manage an organization.",
    afterReg: 'You will have access to manage events and teams for your organization',
    icon: Shield,
  },
  judge: {
    title: "You've Been Invited as a Judge!",
    label: 'Judge Account',
    description: "You've been invited to join as a judge.",
    afterReg: 'An admin will assign you to events once your account is created',
    icon: UserCheck,
  },
  participant: {
    title: "You've Been Invited as a Participant!",
    label: 'Participant Account',
    description: "You've been invited to join as a participant.",
    afterReg: 'You can browse and register for events once your account is created',
    icon: GraduationCap,
  },
};

export default function InviteLandingPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setIsLoadingInfo(false);
      return;
    }

    const load = async () => {
      try {
        const [data, user] = await Promise.all([
          apiFetch<{ invitation: InvitationInfo }>(
            `/api/invite/validate?token=${encodeURIComponent(token)}`
          ),
          authClient.getUser(),
        ]);
        setInvitationInfo(data.invitation);
        setSessionEmail(user?.email ?? null);
      } catch (error) {
        setError(messageOf(error, 'Failed to load invitation details'));
      } finally {
        setIsLoadingInfo(false);
      }
    };

    load();
  }, [token]);

  const loginUrl = `/auth/login?next=${encodeURIComponent(`/invite/${token}`)}`;
  const sessionMatchesInvite =
    !!sessionEmail &&
    !!invitationInfo &&
    sessionEmail.toLowerCase() === invitationInfo.email.toLowerCase();

  interface AcceptResponse {
    redirectUrl?: string;
    email?: string;
    message?: string;
  }

  const postAccept = (body: Record<string, string>) =>
    apiFetch<AcceptResponse>('/api/invite/accept', { method: 'POST', body: { token, ...body } });

  // New account: choose a password, then sign in with it
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await postAccept({ password });

      const { error: signInError } = await authClient.signInWithEmail(
        data.email ?? invitationInfo?.email ?? '',
        password
      );
      if (signInError) {
        toast.success('Account created. Please log in with your new password.');
        router.push('/auth/login');
        return;
      }

      toast.success('Welcome! Your account is ready.');
      router.push(data.redirectUrl || '/');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EXISTING_ACCOUNT') {
        setExistingAccount(true);
        return;
      }
      setFormError(messageOf(error, 'Failed to accept invitation'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Existing account, logged in as the invited email
  const handleAcceptLoggedIn = async () => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const data = await postAccept({});
      toast.success(data.message || 'Invitation accepted');
      router.push(data.redirectUrl || '/');
    } catch (error) {
      setFormError(messageOf(error, 'Failed to accept invitation'));
      const redirectUrl = error instanceof ApiError ? error.data.redirectUrl : undefined;
      if (typeof redirectUrl === 'string') {
        setTimeout(() => router.push(redirectUrl), 2500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await authClient.signOut();
    setSessionEmail(null);
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
          <CardContent>
            <LoadingState label="Loading invitation…" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const role = invitationInfo?.role || 'judge';
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.judge;
  const RoleIcon = config.icon;

  const renderAction = () => {
    if (existingAccount) {
      return (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">This email already has an account.</p>
          <p className="text-sm text-muted-foreground">
            Log in to accept the invitation with your existing account.
          </p>
          <Button className="w-full" asChild>
            <Link href={loginUrl}>Log in to accept</Link>
          </Button>
        </div>
      );
    }

    if (sessionEmail && sessionMatchesInvite) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You are logged in as <span className="font-medium">{sessionEmail}</span>.
          </p>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <Button
            className="w-full"
            size="lg"
            onClick={handleAcceptLoggedIn}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Accepting...' : 'Accept invitation'}
          </Button>
        </div>
      );
    }

    if (sessionEmail && !sessionMatchesInvite) {
      return (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            You are logged in as <span className="font-medium">{sessionEmail}</span>, but this
            invitation is for <span className="font-medium">{invitationInfo?.email}</span>.
          </p>
          <Button variant="outline" className="w-full" onClick={handleSwitchAccount}>
            Log out and continue
          </Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleCreateAccount} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="invite-password">Password</Label>
          <Input
            id="invite-password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invite-confirm-password">Confirm Password</Label>
          <Input
            id="invite-confirm-password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {formError && <p className="text-sm text-red-500">{formError}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Already have an account with this email?{' '}
          <Link href={loginUrl} className="underline underline-offset-4">
            Log in to accept
          </Link>
        </p>
      </form>
    );
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
          <CardDescription>Choose a password to finish creating your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
              <RoleIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">{config.label}</p>
                <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
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
              <KeyRound className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Your login</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You will sign in with <strong>{invitationInfo?.email}</strong> and the password
                  you choose below. No email is sent.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
              <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">After Registration</p>
                <p className="text-sm text-muted-foreground mt-1">{config.afterReg}</p>
              </div>
            </div>
          </div>

          {renderAction()}
        </CardContent>
      </Card>
    </div>
  );
}
