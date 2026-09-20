/**
 * Shared helpers for the route handler specs. A spec mocks `@/lib/auth` (the
 * `authServer` object), `@/lib/auth/org` and `@/lib/db`, then uses these to
 * describe who is signed in and to assert on the error envelope.
 */
import { vi, expect } from 'vitest';
import type { UserRole } from '@/lib/auth';

export type Role = UserRole;
export const ROLES: Role[] = ['super_admin', 'admin', 'judge', 'participant'];

export interface FakeUser {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

/** The shape `vi.mock('@/lib/auth', …)` gives `authServer`. */
export function buildAuthServerMock() {
  return {
    getUser: vi.fn(),
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    requireAdmin: vi.fn(),
    requireJudge: vi.fn(),
    requireSuperAdmin: vi.fn(),
    requireParticipant: vi.fn(),
  };
}

export type AuthServerMock = ReturnType<typeof buildAuthServerMock>;

export function fakeUser(role: Role, overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: `${role}-1`,
    email: `${role}@example.com`,
    role,
    organizationId: role === 'admin' ? 'org-1' : null,
    ...overrides,
  };
}

const REQUIRE_BY_ROLE: Record<Role, keyof AuthServerMock> = {
  super_admin: 'requireSuperAdmin',
  admin: 'requireAdmin',
  judge: 'requireJudge',
  participant: 'requireParticipant',
};

/** Every `require*` resolves for `user.role` and rejects with the helper's error otherwise. */
export function signInAs(auth: AuthServerMock, user: FakeUser) {
  auth.getUser.mockResolvedValue(user);
  auth.requireAuth.mockResolvedValue(user);
  auth.requireRole.mockImplementation(async (role: Role) => {
    if (role !== user.role) throw new Error(`${role} role required`);
    return user;
  });
  for (const role of ROLES) {
    const method = REQUIRE_BY_ROLE[role];
    if (role === user.role) {
      auth[method].mockResolvedValue(user);
    } else {
      auth[method].mockRejectedValue(new Error(`${role} role required`));
    }
  }
  return user;
}

/** Nobody is signed in: every helper throws the authentication error. */
export function signOut(auth: AuthServerMock) {
  auth.getUser.mockResolvedValue(null);
  const error = new Error('Authentication required');
  auth.requireAuth.mockRejectedValue(error);
  auth.requireRole.mockRejectedValue(error);
  for (const role of ROLES) auth[REQUIRE_BY_ROLE[role]].mockRejectedValue(error);
}

/** The shape `vi.mock('@/lib/auth/org', …)` gives the org helpers. */
export function buildOrgMock() {
  return {
    getAdminOrgId: vi.fn(),
    requireEventInOrg: vi.fn(),
    verifyEventInOrg: vi.fn(),
  };
}

export type OrgMock = ReturnType<typeof buildOrgMock>;

export const CROSS_ORG_ERROR = new Error('Event does not belong to your organization');

/** The admin belongs to `orgId`; events either belong to it or not. */
export function scopeToOrg(org: OrgMock, orgId = 'org-1', eventBelongs = true) {
  org.getAdminOrgId.mockResolvedValue(orgId);
  org.verifyEventInOrg.mockResolvedValue(eventBelongs);
  if (eventBelongs) {
    org.requireEventInOrg.mockResolvedValue(undefined);
  } else {
    org.requireEventInOrg.mockRejectedValue(CROSS_ORG_ERROR);
  }
}

/** A PostgreSQL unique violation as Drizzle surfaces it (`cause` holds the driver error). */
export function uniqueViolation(constraint: string): Error {
  const cause = Object.assign(new Error(`duplicate key value violates "${constraint}"`), {
    code: '23505',
    constraint_name: constraint,
  });
  return Object.assign(new Error('Failed query'), { cause });
}

/** Asserts the `{ error, error_code, error_message }` envelope and returns the body. */
export async function expectApiError(response: Response, status: number, code: string) {
  const body = await response.json();
  expect({ status: response.status, code: body.error_code }).toEqual({ status, code });
  expect(body.error).toBe(body.error_message);
  expect(typeof body.error).toBe('string');
  return body as { error: string; error_code: string; error_message: string } & Record<
    string,
    unknown
  >;
}

/** Asserts a 2xx JSON response and returns the parsed body. */
export async function expectJson<T = Record<string, unknown>>(
  response: Response,
  status = 200
): Promise<T> {
  const body = await response.json();
  expect({ status: response.status, body }).toMatchObject({ status });
  return body as T;
}
