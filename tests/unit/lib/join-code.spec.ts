import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { generateJoinCode, isValidJoinCode } from '@/lib/utils/join-code';
import {
  buildSelectMock,
  mockSelectSequence,
  resetDbMock,
  type DbMock,
} from '@/tests/unit/test-utils/mock-db';

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});

const dbMock = db as unknown as DbMock;

describe('isValidJoinCode', () => {
  it('accepts six characters from the unambiguous alphabet', () => {
    expect(isValidJoinCode('ABC234')).toBe(true);
    expect(isValidJoinCode('HJKMNP')).toBe(true);
    expect(isValidJoinCode('ZZ9999')).toBe(true);
  });

  it.each(['ABC23', 'ABC2345', 'abc234', 'ABC10I', 'ABCO23', 'ABC-23', '', 'ABC 23'])(
    'rejects %j (wrong length, lowercase, I/O/0/1 or symbols)',
    (code) => {
      expect(isValidJoinCode(code)).toBe(false);
    }
  );
});

describe('generateJoinCode', () => {
  beforeEach(() => resetDbMock(dbMock));

  it('returns a valid code that no team uses yet', async () => {
    mockSelectSequence(dbMock.select, []);
    const code = await generateJoinCode();
    expect(isValidJoinCode(code)).toBe(true);
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });

  it('retries on a collision', async () => {
    mockSelectSequence(dbMock.select, [{ id: 't1' }], [{ id: 't2' }], []);
    const code = await generateJoinCode();
    expect(isValidJoinCode(code)).toBe(true);
    expect(dbMock.select).toHaveBeenCalledTimes(3);
  });

  it('gives up after the retry budget', async () => {
    mockSelectSequence(dbMock.select, [{ id: 't1' }], [{ id: 't1' }]);
    await expect(generateJoinCode(2)).rejects.toThrow(/maximum retries/);
  });

  it('never produces an ambiguous character across many draws', async () => {
    dbMock.select.mockImplementation(() => buildSelectMock([]));
    for (let i = 0; i < 200; i++) {
      expect(await generateJoinCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });
});
