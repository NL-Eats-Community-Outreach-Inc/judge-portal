import { vi } from 'vitest';
import { db } from '@/lib/db';

type SelectResult = ReturnType<typeof db.select>;
type InsertResult = ReturnType<typeof db.insert>;

/**
 Build a Drizzle-compatible mock for a db.select()
 */
export function buildSelectMock(result: unknown[]): SelectResult {
  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain as unknown as SelectResult;
}

/**
 Build a Drizzle mock for a `db.insert() 
 */
export function buildMutationMock(result: unknown[] = []): InsertResult {
  const chain: Record<string, unknown> = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn(() => Promise.resolve(result)),
    onConflictDoNothing: vi.fn(() => Promise.resolve(result)),
    returning: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain as unknown as InsertResult;
}

/**
 Same as buildSelectMock, but also returns the object typed
 as `any` 
 */
export function buildAssertableSelectMock(result: unknown[]) {
  const mock = buildSelectMock(result);
  return { selectMock: mock, chain: mock as unknown as Record<string, ReturnType<typeof vi.fn>> };
}

/**
Same as buildMutationMock, but also returns the object typed
as `any` 
 */
export function buildAssertableMutationMock(result: unknown[] = []) {
  const mock = buildMutationMock(result);
  return { insertMock: mock, chain: mock as unknown as Record<string, ReturnType<typeof vi.fn>> };
}

/**
 Queue up sequential `db.select()` mock results, one per call in order.

 */
export function mockSelectSequence(selectMock: ReturnType<typeof vi.fn>, ...results: unknown[][]) {
  selectMock.mockReset();
  results.forEach((result) => selectMock.mockReturnValueOnce(buildSelectMock(result)));
}
