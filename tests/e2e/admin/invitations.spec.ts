import { test, expect, contextFor } from '../support/fixtures';
import { E2E_ORGANIZATION } from '../support/accounts';
import { submitLoginForm } from '../support/login';
import type { Page } from '@playwright/test';
import {
  deleteInvitationsFor,
  deleteUserByEmail,
  ensureUser,
  ensureAuthUserWithoutProfile,
  findAuthUserByEmail,
  removeMembership,
  ensureOrganization,
} from '../support/supabase-admin';
import { qaName, createEvent, deleteEvent, orgJudges } from '../support/api';

/**
 * Invitation links set a password and send no email: a new judge accepts
 * through the link; an existing judge is sent to login first and gains the
 * membership after "Accept invitation"; a revoked link is refused (Phase H3).
 */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const NEW_JUDGE = {
  email: `qa-invite-new-${suffix}@example.com`,
  password: 'InviteePassphrase28940!',
};
const EXISTING_JUDGE = {
  email: `qa-invite-existing-${suffix}@example.com`,
  password: 'ExistingPassphrase28940!',
};
const REVOKED = { email: `qa-invite-revoked-${suffix}@example.com` };
const SYNCED = { email: `qa-sync-judge-${suffix}@example.com`, password: 'SyncedPassphrase28940!' };

/** The row for `email` in the Invitations table (the Users table may list the same address). */
function invitationRow(page: Page, email: string) {
  return page
    .locator('table')
    .filter({ has: page.getByRole('columnheader', { name: 'Expires' }) })
    .getByRole('row', { name: new RegExp(email) });
}

test.describe('Admin invitations', () => {
  // the steps build on each other: a failure skips the rest instead of rerunning setup
  test.describe.configure({ mode: 'serial' });

  test.afterAll(async () => {
    for (const { email } of [NEW_JUDGE, EXISTING_JUDGE, REVOKED, SYNCED]) {
      await deleteInvitationsFor(email);
      await deleteUserByEmail(email);
    }
  });

  test('a new judge accepts the link with a password and lands on the judge dashboard; the link is single-use', async ({
    browser,
  }) => {
    const admin = await contextFor(browser, 'admin');
    const page = await admin.newPage();
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Users' }).click();
    await page.getByRole('button', { name: 'Invite Users' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite Users' });
    await expect(dialog).toContainText('no email is sent');
    await dialog.locator('#emails').fill(NEW_JUDGE.email);
    await dialog.getByRole('button', { name: 'Send Invitations' }).click();
    await expect(dialog.getByText('Invitations Created!')).toBeVisible();
    const inviteLink = (await dialog
      .getByText(/\/invite\//)
      .first()
      .textContent())!.trim();
    expect(inviteLink).toMatch(/\/invite\/[0-9a-f-]{36}$/);
    await dialog.getByRole('button', { name: 'Done' }).click();

    // the list shows it as pending
    await expect(invitationRow(page, NEW_JUDGE.email)).toContainText('Pending');

    // the invitee opens the link in a fresh, logged-out context
    const invitee = await browser.newContext();
    const invitePage = await invitee.newPage();
    await invitePage.goto(inviteLink);
    await expect(invitePage.getByText("You've Been Invited as a Judge!")).toBeVisible();
    await expect(invitePage.getByText(NEW_JUDGE.email)).toBeVisible();
    await expect(invitePage.getByText(E2E_ORGANIZATION.name)).toBeVisible();
    await expect(invitePage.getByText('Email Verification')).toHaveCount(0);

    await invitePage.locator('#invite-password').fill(NEW_JUDGE.password);
    await invitePage.locator('#invite-confirm-password').fill('mismatch');
    await invitePage.getByRole('button', { name: 'Create account' }).click();
    await expect(invitePage.getByText('Passwords do not match')).toBeVisible();

    await invitePage.locator('#invite-confirm-password').fill(NEW_JUDGE.password);
    await invitePage.getByRole('button', { name: 'Create account' }).click();
    await invitePage.waitForURL(/\/judge/, { timeout: 60_000 });

    const memberships = (await (
      await invitePage.request.get('/api/judge/organizations')
    ).json()) as {
      memberships: Array<{ orgName: string }>;
    };
    expect(memberships.memberships.map((m) => m.orgName)).toContain(E2E_ORGANIZATION.name);

    // single-use
    const reuse = await invitee.newPage();
    await reuse.goto(inviteLink);
    await expect(reuse.getByText('This invitation has already been used')).toBeVisible();
    await invitee.close();

    await page.reload();
    await page.getByRole('tab', { name: 'Users' }).click();
    await expect(invitationRow(page, NEW_JUDGE.email)).toContainText('Accepted');
    await admin.close();
  });

  test('an existing judge is sent to login and gains the organization after accepting', async ({
    browser,
    adminApi,
  }) => {
    // invitation first, then the account appears on its own (a self sign-up elsewhere)
    const created = await adminApi.post('/api/admin/invitations', {
      data: { emails: [EXISTING_JUDGE.email], role: 'judge' },
    });
    expect(created.status()).toBe(201);
    const inviteLink = ((await created.json()) as { invitations: Array<{ inviteLink: string }> })
      .invitations[0].inviteLink;
    const userId = await ensureUser(EXISTING_JUDGE.email, EXISTING_JUDGE.password, 'judge');
    const orgId = await ensureOrganization(E2E_ORGANIZATION.name, E2E_ORGANIZATION.slug);
    await removeMembership(orgId, userId);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(inviteLink);
    await page.locator('#invite-password').fill('whatever-pass');
    await page.locator('#invite-confirm-password').fill('whatever-pass');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('This email already has an account.')).toBeVisible();

    await page.getByRole('link', { name: 'Log in to accept' }).click();
    await expect(page).toHaveURL(/\/auth\/login\?next=/);
    await submitLoginForm(page, EXISTING_JUDGE.email, EXISTING_JUDGE.password);
    await page.waitForURL(/\/invite\//);
    await expect(page.getByText(`You are logged in as`)).toBeVisible();
    await page.getByRole('button', { name: 'Accept invitation' }).click();
    await page.waitForURL(/\/judge/, { timeout: 60_000 });

    const memberships = (await (await page.request.get('/api/judge/organizations')).json()) as {
      memberships: Array<{ orgName: string }>;
    };
    expect(memberships.memberships.map((m) => m.orgName)).toContain(E2E_ORGANIZATION.name);
    await context.close();
  });

  test('the old verify URL redirects to the invitation page and the OTP route is closed; a revoked link is refused', async ({
    browser,
    adminApi,
  }) => {
    const created = await adminApi.post('/api/admin/invitations', {
      data: { emails: [REVOKED.email], role: 'judge' },
    });
    expect(created.status()).toBe(201);
    const invitation = (
      (await created.json()) as { invitations: Array<{ id: string; inviteLink: string }> }
    ).invitations[0];
    const token = invitation.inviteLink.split('/invite/')[1];

    // H8: the email-code step is gone; nothing here can send an email
    const visitor = await browser.newContext();
    const verifyPage = await visitor.newPage();
    await verifyPage.goto(`/invite/${token}/verify`);
    await expect(verifyPage).toHaveURL(new RegExp(`/invite/${token}$`));
    await expect(verifyPage.getByText("You've Been Invited as a Judge!")).toBeVisible();
    const validate = await visitor.request.post('/api/invite/validate', { data: { token } });
    expect(validate.status()).toBe(404);
    expect(((await validate.json()) as { error_code: string }).error_code).toBe('FEATURE_DISABLED');
    await visitor.close();

    const admin = await contextFor(browser, 'admin');
    const page = await admin.newPage();
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Users' }).click();
    const row = invitationRow(page, REVOKED.email);
    await expect(row).toContainText('Pending');
    await row.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: 'Revoke Invitation' }).click();
    await expect(row).toContainText('Revoked');
    await admin.close();

    const context = await browser.newContext();
    const page2 = await context.newPage();
    await page2.goto(invitation.inviteLink);
    await expect(page2.getByText('This invitation has been revoked')).toBeVisible();
    await context.close();

    expect(await findAuthUserByEmail(REVOKED.email)).toBeNull();
  });

  test('H5: sync-users creates a missing profile in the organization so the judge can be assigned', async ({
    adminApi,
  }) => {
    const orgId = await ensureOrganization(E2E_ORGANIZATION.name, E2E_ORGANIZATION.slug);
    const authId = await ensureAuthUserWithoutProfile(SYNCED.email, SYNCED.password, {
      role: 'judge',
    });
    const eventName = qaName('Sync');
    const eventId = (await createEvent(adminApi, eventName)).id;
    try {
      const sync = await adminApi.post('/api/admin/sync-users');
      expect(sync.status()).toBe(200);
      const { results } = (await sync.json()) as {
        results: Array<{ id: string; action: string; role?: string; organizationId?: string }>;
      };
      expect(results.find((r) => r.id === authId)).toMatchObject({
        action: 'created',
        role: 'judge',
        organizationId: orgId,
      });
      // a member now: Judge Assignments lists them
      expect((await orgJudges(adminApi, eventId)).map((j) => j.email)).toContain(SYNCED.email);
    } finally {
      await deleteEvent(adminApi, eventId, eventName);
    }
  });
});
