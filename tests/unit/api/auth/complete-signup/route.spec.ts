import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/complete-signup/route';
import { authServer } from '@/lib/auth';
import { completeSignup } from '@/lib/auth/complete-signup';
import { fakeUser } from '@/tests/unit/test-utils/route-harness';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  completeSignup: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authServer: {
    getUser: mocks.getUser,
  },
}));

vi.mock('@/lib/auth/complete-signup', () => ({
  completeSignup: mocks.completeSignup,
}));

const completeSignupMock = vi.mocked(completeSignup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue(null);
});

describe('POST /api/auth/complete-signup', () => {
  it('returns 401 when unauthenticated', async () => {
    const response = await POST();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'Authentication required',
    });
    expect(completeSignupMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the user has no email', async () => {
    mocks.getUser.mockResolvedValue(fakeUser('learner', { email: '' }));

    const response = await POST();

    expect(response.status).toBe(401);
    expect(completeSignupMock).not.toHaveBeenCalled();
  });

  it('completes signup using the authenticated user metadata', async () => {
    const user = {
      ...fakeUser('learner'),
      user_metadata: {
        roles: ['learner', 'judge'],
        organization_ids: ['org-1'],
      },
    };

    mocks.getUser.mockResolvedValue(user);

    const result = {
      roles: ['learner', 'judge'] as ('judge' | 'participant' | 'learner')[],
      activeRole: 'learner' as 'judge' | 'participant' | 'learner',
    };

    completeSignupMock.mockResolvedValue(result);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(completeSignupMock).toHaveBeenCalledWith(user.id, user.email, user.user_metadata);
  });

  it('passes empty metadata when user metadata is null', async () => {
    const user = {
      ...fakeUser('learner'),
      user_metadata: null,
    };

    mocks.getUser.mockResolvedValue(user);
    completeSignupMock.mockResolvedValue({
      roles: ['learner'],
      activeRole: 'learner',
    });

    await POST();

    expect(completeSignupMock).toHaveBeenCalledWith(user.id, user.email, {});
  });

  it('returns 500 when signup completion fails', async () => {
    mocks.getUser.mockResolvedValue(fakeUser('learner'));
    completeSignupMock.mockRejectedValue(new Error('Signup failed'));

    const response = await POST();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to complete account setup',
    });
  });
});
