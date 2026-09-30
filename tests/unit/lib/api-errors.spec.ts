import { describe, it, expect, vi } from 'vitest';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { OrphanedAdminError } from '@/lib/auth/org';

vi.mock('@/lib/db', () => ({ db: {} }));

async function envelope(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe('sendApiError', () => {
  it('returns the one error shape with the message under both keys', async () => {
    const { status, body } = await envelope(sendApiError(400, 'BAD_REQUEST', 'Name is required'));
    expect(status).toBe(400);
    expect(body).toEqual({
      error: 'Name is required',
      error_code: 'BAD_REQUEST',
      error_message: 'Name is required',
    });
  });

  it('merges extra fields without letting them override the envelope keys', async () => {
    const { status, body } = await envelope(
      sendApiError(400, 'ALREADY_HAS_ACCOUNT', 'You already have an account', {
        redirectUrl: '/judge',
        error_code: 'SPOOFED',
      })
    );
    expect(status).toBe(400);
    expect(body).toEqual({
      error: 'You already have an account',
      error_code: 'ALREADY_HAS_ACCOUNT',
      error_message: 'You already have an account',
      redirectUrl: '/judge',
    });
  });
});

describe('handleRouteError', () => {
  const silence = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  it.each([
    ['Authentication required', 401, 'UNAUTHORIZED'],
    ['admin role required', 403, 'FORBIDDEN'],
    ['judge role required', 403, 'FORBIDDEN'],
    ['participant role required', 403, 'FORBIDDEN'],
    ['super_admin role required', 403, 'FORBIDDEN'],
    ['Event does not belong to your organization', 404, 'NOT_FOUND'],
    ['NOT_MEMBER', 403, 'NOT_MEMBER'],
    ['NOT_CREATOR', 403, 'NOT_CREATOR'],
    ['TEAM_NOT_FOUND', 404, 'TEAM_NOT_FOUND'],
    ['EVENT_NOT_OPEN', 400, 'EVENT_NOT_OPEN'],
    ['NOT_REGISTERED', 400, 'NOT_REGISTERED'],
  ])('maps "%s" to %i %s', async (message, status, code) => {
    const { status: got, body } = await envelope(handleRouteError(new Error(message), 'ctx'));
    expect(got).toBe(status);
    expect(body.error_code).toBe(code);
    expect(body.error).toBe(body.error_message);
  });

  it('maps OrphanedAdminError to 403 NO_ORGANIZATION', async () => {
    const { status, body } = await envelope(handleRouteError(new OrphanedAdminError(), 'ctx'));
    expect(status).toBe(403);
    expect(body.error_code).toBe('NO_ORGANIZATION');
  });

  it('maps a unique violation (wrapped or bare) to 409 CONFLICT', async () => {
    const bare = Object.assign(new Error('dup'), { code: '23505', constraint_name: 'x' });
    const wrapped = Object.assign(new Error('Failed query'), { cause: bare });
    for (const error of [bare, wrapped]) {
      const { status, body } = await envelope(handleRouteError(error, 'ctx'));
      expect(status).toBe(409);
      expect(body.error_code).toBe('CONFLICT');
    }
  });

  it('logs and answers 500 for anything else, including non-Error values', async () => {
    const spy = silence();
    // 'constructor' / 'toString' are Object.prototype keys: they are not known errors
    for (const error of [
      new Error('connection reset'),
      new Error('constructor'),
      new Error('toString'),
      'string error',
      null,
    ]) {
      const { status, body } = await envelope(handleRouteError(error, 'Error creating team'));
      expect(status).toBe(500);
      expect(body).toEqual({
        error: 'Internal server error',
        error_code: 'INTERNAL_SERVER_ERROR',
        error_message: 'Internal server error',
      });
    }
    expect(spy).toHaveBeenCalledTimes(5);
    expect(spy).toHaveBeenCalledWith('Error creating team:', expect.anything());
    spy.mockRestore();
  });

  it('does not treat a message that merely contains a role word as an auth error', async () => {
    const spy = silence();
    const { status } = await envelope(
      handleRouteError(new Error('judge role required by policy'), 'c')
    );
    expect(status).toBe(500);
    spy.mockRestore();
  });
});
