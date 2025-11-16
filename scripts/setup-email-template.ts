#!/usr/bin/env tsx

/**
 * Setup Supabase Email Template for OTP Display
 *
 * This script updates the email template to display the OTP code
 * with high visibility and contrast.
 *
 * Usage:
 *   npm run setup:email-template
 *
 * Required environment variables:
 *   SUPABASE_ACCESS_TOKEN - Your Supabase access token
 *   NEXT_PUBLIC_SUPABASE_URL - Your Supabase project URL
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Extract project reference from Supabase URL
const extractProjectRef = (url: string | undefined): string | null => {
  if (!url) return null;
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
};

const PROJECT_REF = extractProjectRef(SUPABASE_URL);

// HIGH CONTRAST OTP email template
const OTP_EMAIL_TEMPLATE = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
  <h2 style="color: #111827; font-size: 24px; font-weight: 600; margin-bottom: 16px; margin-top: 0;">Verify Your Email</h2>

  <p style="color: #374151; font-size: 16px; line-height: 24px; margin-bottom: 32px;">
    Enter this verification code to complete your registration:
  </p>

  <!-- HIGH CONTRAST CODE BOX -->
  <div style="background-color: #1f2937; padding: 40px 32px; border-radius: 16px; text-align: center; margin: 32px 0; border: 3px solid #3b82f6;">
    <div style="font-size: 56px; font-weight: 900; letter-spacing: 16px; margin: 0; font-family: 'Courier New', Courier, monospace; color: #ffffff; line-height: 1.2;">{{ .Token }}</div>
  </div>

  <!-- EXPIRATION NOTICE -->
  <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 8px; margin: 32px 0;">
    <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 0; line-height: 20px;">
      ⏱️ This verification code expires in 1 hour for security purposes
    </p>
  </div>

  <!-- SECURITY DISCLAIMER -->
  <p style="color: #6b7280; font-size: 13px; line-height: 20px; margin-top: 32px; padding-top: 24px; border-top: 2px solid #e5e7eb;">
    If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.
  </p>
</div>
`.trim();

async function updateEmailTemplate() {
  // Validate environment variables
  if (!SUPABASE_ACCESS_TOKEN || !PROJECT_REF) {
    console.error('❌ Missing required environment variables');
    console.log('\nPlease ensure .env.local has:');
    console.log('  SUPABASE_ACCESS_TOKEN=your_token');
    console.log('  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co');
    process.exit(1);
  }

  console.log('🔧 Updating Supabase email templates...');
  console.log(`📋 Project: ${PROJECT_REF}\n`);

  try {
    const payload = {
      // Use lowercase field names as required by Supabase API
      mailer_subjects_magic_link: "Verify Your Email - OTP Code",
      mailer_templates_magic_link_content: OTP_EMAIL_TEMPLATE,
      mailer_subjects_confirmation: "Verify Your Email - OTP Code",
      mailer_templates_confirmation_content: OTP_EMAIL_TEMPLATE,
      // Set OTP to 6 digits instead of default 8
      mailer_otp_length: 6,
      // OTP expiration: 3600 seconds = 1 hour (standard security practice)
      mailer_otp_exp: 3600,
    };

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    await response.json();

    console.log('✅ Email templates updated successfully!\n');
    console.log('📧 Email now features:');
    console.log('  ✓ Dark background with white text (high contrast)');
    console.log('  ✓ Extra large font size (56px)');
    console.log('  ✓ Blue border for emphasis');
    console.log('  ✓ Clear expiration notice (1 hour)');
    console.log('\n⚙️  Settings updated:');
    console.log('  ✓ OTP length: 6 digits (was 8)');
    console.log('  ✓ OTP expiration: 1 hour (standard security)');
    console.log('\n📝 Note: Invitation links can be valid for days/weeks,');
    console.log('    but OTP codes expire in 1 hour for security.');
    console.log('\n🧪 Test: Request a new OTP code to see the updated design');
    console.log('');

  } catch (error) {
    console.error('❌ Failed to update email template:', error);

    if (error instanceof Error && error.message.includes('401')) {
      console.log('\n💡 Token invalid. Get new token from:');
      console.log('   https://supabase.com/dashboard/account/tokens');
    }

    process.exit(1);
  }
}

// Run the script
updateEmailTemplate().catch(console.error);
