import path from 'path';

/**
 * The six end-to-end accounts. Emails and passwords come from `.env.local`
 * (the `*_EMAIL` / `*_PASSWORD` block) with defaults for anything missing;
 * `global-setup.ts` creates or repairs every account before the specs run,
 * so the only requirement is a service-role key for the test project.
 */
export type RoleKey =
  | 'admin'
  | 'judge1'
  | 'judge2'
  | 'judge3'
  | 'participantA'
  | 'participantB'
  | 'superAdmin';

export interface Account {
  key: RoleKey;
  email: string;
  password: string;
  role: 'admin' | 'judge' | 'participant' | 'super_admin';
  home: string;
}

function env(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const ACCOUNTS: Record<RoleKey, Account> = {
  admin: {
    key: 'admin',
    email: env('ADMIN_EMAIL', 'admin@test.com'),
    password: env('ADMIN_PASSWORD', '123456'),
    role: 'admin',
    home: '/admin',
  },
  judge1: {
    key: 'judge1',
    email: env('JUDGE1_EMAIL', 'judge1@test.com'),
    password: env('JUDGE1_PASSWORD', '123456'),
    role: 'judge',
    home: '/judge',
  },
  judge2: {
    key: 'judge2',
    email: env('JUDGE2_EMAIL', 'judge2@test.com'),
    password: env('JUDGE2_PASSWORD', '123456'),
    role: 'judge',
    home: '/judge',
  },
  judge3: {
    key: 'judge3',
    email: env('JUDGE3_EMAIL', 'judge3@test.com'),
    password: env('JUDGE3_PASSWORD', '123456'),
    role: 'judge',
    home: '/judge',
  },
  participantA: {
    key: 'participantA',
    email: env('PARTICIPANT1_EMAIL', 'participant1@test.com'),
    password: env('PARTICIPANT1_PASSWORD', '123456'),
    role: 'participant',
    home: '/participant',
  },
  participantB: {
    key: 'participantB',
    email: env('PARTICIPANT2_EMAIL', 'participant2@test.com'),
    password: env('PARTICIPANT2_PASSWORD', '123456'),
    role: 'participant',
    home: '/participant',
  },
  superAdmin: {
    key: 'superAdmin',
    email: env('SUPER_ADMIN_EMAIL', 'super.admin@test.com'),
    password: env('SUPER_ADMIN_PASSWORD', '123456'),
    role: 'super_admin',
    home: '/super-admin',
  },
};

/** The organization every end-to-end account is wired to. */
export const E2E_ORGANIZATION = { name: 'QA Organization', slug: 'qa-organization' };

export const AUTH_DIR = path.join(process.cwd(), 'tests', 'e2e', '.auth');

export function storageStatePath(key: RoleKey): string {
  return path.join(AUTH_DIR, `${key}.json`);
}
