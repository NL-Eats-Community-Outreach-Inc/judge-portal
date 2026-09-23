import { test, expect, contextFor } from '../support/fixtures';
import {
  deleteInvitationsFor,
  deleteOrganizationBySlug,
  deleteUserByEmail,
  ensureUser,
} from '../support/supabase-admin';

/**
 * Super admin (Phase B4 and §2.7): create an organization, invite an admin
 * (password path), change a user's role, list users.
 */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const ORG = { name: `QA Org ${suffix}`, slug: `qa-org-${suffix}` };
const ADMIN_INVITEE = {
  email: `qa-admin-invitee-${suffix}@example.com`,
  password: 'AdminInviteePass28940!',
};
const ROLE_USER = {
  email: `qa-role-change-${suffix}@example.com`,
  password: 'RoleChangePass28940!',
};

test.describe('Super admin organizations and users', () => {
  test.afterAll(async () => {
    await deleteInvitationsFor(ADMIN_INVITEE.email);
    await deleteUserByEmail(ADMIN_INVITEE.email);
    await deleteUserByEmail(ROLE_USER.email);
    await deleteOrganizationBySlug(ORG.slug);
  });

  test('creates an organization, invites an admin who accepts with a password, changes a role and lists users', async ({
    browser,
    superAdminApi,
  }) => {
    const context = await contextFor(browser, 'superAdmin');
    const page = await context.newPage();
    await page.goto('/super-admin');

    // create the organization
    await page.getByRole('button', { name: 'New', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Create Organization' });
    await dialog.locator('#org-name').fill(ORG.name);
    await dialog.locator('#org-slug').fill(ORG.slug);
    await dialog.getByRole('button', { name: 'Create Organization' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(ORG.name).filter({ visible: true }).first()).toBeVisible();

    const orgs = (await (await superAdminApi.get('/api/super-admin/organizations')).json()) as {
      organizations: Array<{ id: string; slug: string; adminCount: number }>;
    };
    const org = orgs.organizations.find((o) => o.slug === ORG.slug)!;
    expect(org).toBeDefined();
    expect(org.adminCount).toBe(0);

    // invite an admin from the organization panel
    await page.getByText(ORG.name).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: 'Invite Admin' }).click();
    const invite = page.getByRole('dialog', { name: `Invite Admin to ${ORG.name}` });
    await invite.locator('#admin-emails').fill(ADMIN_INVITEE.email);
    await invite.getByRole('button', { name: 'Send Invitations' }).click();
    await expect(invite.getByText('Invitations Created!')).toBeVisible();
    const inviteLink = (await invite
      .getByText(/\/invite\//)
      .first()
      .textContent())!.trim();
    await page.keyboard.press('Escape');

    // the invitee sets a password and lands on the admin dashboard of the new organization
    const invitee = await browser.newContext();
    const invitePage = await invitee.newPage();
    await invitePage.goto(inviteLink);
    await expect(invitePage.getByText("You've Been Invited as an Admin!")).toBeVisible();
    await expect(invitePage.getByText(ORG.name)).toBeVisible();
    await invitePage.locator('#invite-password').fill(ADMIN_INVITEE.password);
    await invitePage.locator('#invite-confirm-password').fill(ADMIN_INVITEE.password);
    await invitePage.getByRole('button', { name: 'Create account' }).click();
    await invitePage.waitForURL(/\/admin/, { timeout: 60_000 });
    await expect(invitePage.getByText(ORG.name)).toBeVisible();
    await invitee.close();

    const after = (await (
      await superAdminApi.get(`/api/super-admin/organizations/${org.id}`)
    ).json()) as {
      organization: { adminCount: number };
    };
    expect(after.organization.adminCount).toBe(1);

    // change a participant's role to judge in the Users tab
    await ensureUser(ROLE_USER.email, ROLE_USER.password, 'participant');
    await page.getByRole('tab', { name: 'Users' }).click();
    const row = page.getByRole('row', { name: new RegExp(ROLE_USER.email) });
    await expect(row).toBeVisible();
    await row.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Judge' }).click();
    const confirm = page.getByRole('dialog', { name: 'Confirm Role Change' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Confirm Role Change' }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByText('Role updated')).toBeVisible();

    const users = (await (await superAdminApi.get('/api/super-admin/users')).json()) as {
      users: Array<{ email: string; role: string; organizationMemberships: unknown[] }>;
    };
    expect(users.users.find((u) => u.email === ROLE_USER.email)?.role).toBe('judge');
    expect(users.users.find((u) => u.email === ADMIN_INVITEE.email)?.role).toBe('admin');
    await expect(page.getByRole('row', { name: new RegExp(ADMIN_INVITEE.email) })).toBeVisible();

    await context.close();
  });
});
