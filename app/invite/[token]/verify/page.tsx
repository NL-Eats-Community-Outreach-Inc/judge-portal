import { redirect } from 'next/navigation';
import { EMAIL_FEATURES_ENABLED } from '@/lib/config';
import { InviteVerifyForm } from './components/invite-verify-form';

/**
 * The email-code step of the old invitation flow. Without a mailer the
 * invitation page sets a password instead, so this URL sends visitors there.
 */
export default async function InviteVerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!EMAIL_FEATURES_ENABLED) {
    redirect(`/invite/${token}`);
  }

  return <InviteVerifyForm token={token} />;
}
