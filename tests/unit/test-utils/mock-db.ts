import { vi } from 'vitest';
import type { db } from '@/lib/db';

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
 Build a Drizzle mock for a `db.insert()`, `db.update()` or `db.delete()` chain
 */
export function buildMutationMock(result: unknown[] = []): InsertResult {
  const chain: Record<string, unknown> = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain as unknown as InsertResult;
}

/**
 * A mutation chain that rejects at the end (for example with a unique violation).
 */
export function buildFailingMutationMock(error: unknown): InsertResult {
  const chain: Record<string, unknown> = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn(() => Promise.reject(error)),
    then: (resolve: (v: never) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.reject(error).then(resolve, reject),
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

/**
 * The shape `vi.mock('@/lib/db', …)` returns: every query entry point is a
 * `vi.fn()` the spec configures. `transaction` runs its callback against the
 * same object by default, so `tx.select()` and `db.select()` share one queue;
 * pass a separate object to `mockTransaction` when a spec needs to tell them apart.
 */
export function buildDbMock() {
  const mock = {
    select: vi.fn(),
    selectDistinct: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(() => Promise.resolve([])),
    transaction: vi.fn(),
  };
  mock.transaction.mockImplementation(async (fn: (tx: typeof mock) => unknown) => fn(mock));
  return mock;
}

export type DbMock = ReturnType<typeof buildDbMock>;

/** Reset every function on a db mock and restore the default transaction behaviour. */
export function resetDbMock(mock: DbMock) {
  for (const fn of Object.values(mock)) fn.mockReset();
  mock.execute.mockResolvedValue([]);
  mock.transaction.mockImplementation(async (fn: (tx: DbMock) => unknown) => fn(mock));
}
