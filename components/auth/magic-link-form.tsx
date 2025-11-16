'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface MagicLinkFormProps {
  redirectTo?: string;
  onSuccess?: () => void;
  prefilledEmail?: string;
  shouldCreateUser?: boolean; // For login page: false prevents account creation
}

export function MagicLinkForm({
  redirectTo,
  onSuccess,
  prefilledEmail,
  shouldCreateUser = true, // Default true for invitation flow
}: MagicLinkFormProps) {
  const [email, setEmail] = useState(prefilledEmail || '');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo
            ? `${window.location.origin}${redirectTo}`
            : window.location.origin,
          shouldCreateUser, // Prevent account creation for login page
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
        setEmailSent(true);
        toast.success('Check your email!', {
          description: 'We sent you a 6-digit verification code.',
        });
        onSuccess?.();
      }
    } catch {
      toast.error('Something went wrong', {
        description: 'Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <h3 className="font-semibold text-green-900 dark:text-green-100">Check your email</h3>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            We sent a 6-digit verification code to <strong>{email}</strong>
          </p>
          <p className="mt-2 text-xs text-green-600 dark:text-green-400">
            Enter the code from your email to sign in. The code will expire in 1 hour.
          </p>
        </div>
        <Button variant="outline" onClick={() => setEmailSent(false)} className="w-full">
          Send another link
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
  );
}
