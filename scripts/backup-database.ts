#!/usr/bin/env tsx

/**
 * Database backup and restore without pg_dump.
 *
 * Backup writes one JSON file per public table (all rows) plus schema.json
 * (tables, columns, enums, constraints, indexes, policies, triggers, functions)
 * into backups/<label>-<timestamp>/.
 *
 * Restore inserts the rows from a backup folder in dependency order with
 * ON CONFLICT DO NOTHING. The schema must already exist (npm run db:setup).
 * Restoring `users` requires the matching rows in auth.users to exist.
 *
 * Usage:
 *   npx tsx scripts/backup-database.ts                       # backup DATABASE_URL (test)
 *   npx tsx scripts/backup-database.ts --prod                # backup the commented production URL
 *   npx tsx scripts/backup-database.ts --restore <dir>       # restore into DATABASE_URL
 *   npx tsx scripts/backup-database.ts --restore <dir> --prod --yes
 *
 * --prod reads the commented "# DATABASE_URL=" line at the top of .env.local so the
 * production connection string never has to be pasted into a terminal; it refuses
 * when more than one such line exists. A restore into production needs --yes.
 */

import { config } from 'dotenv';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

config({ path: '.env.local' });

const args = process.argv.slice(2);
const useProd = args.includes('--prod');
const confirmed = args.includes('--yes');
const restoreIndex = args.indexOf('--restore');
const restoreDir = restoreIndex >= 0 ? args[restoreIndex + 1] : null;

if (restoreDir && useProd && !confirmed) {
  console.error('Refusing: a restore into production needs --yes');
  process.exit(1);
}

function resolveUrl(): { url: string; label: string } {
  if (useProd) {
    const env = readFileSync('.env.local', 'utf8');
    const matches = [...env.matchAll(/^#\s*DATABASE_URL=(.+)$/gm)];
    if (matches.length === 0) {
      throw new Error('No commented "# DATABASE_URL=" line found in .env.local');
    }
    if (matches.length > 1) {
      throw new Error(
        `Found ${matches.length} commented "# DATABASE_URL=" lines in .env.local; keep exactly one (the production URL)`
      );
    }
    return { url: matches[0][1].trim(), label: 'production' };
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set in .env.local');
  return { url, label: 'test' };
}

// Parents before children so a restore never hits a missing foreign key.
const RESTORE_ORDER = [
  'organizations',
  'users',
  'events',
  'teams',
  'criteria',
  'event_judges',
  'scores',
  'invitations',
  'event_participants',
  'team_members',
  'organization_members',
  'submissions',
  'submission_ai_scores',
];

const SCHEMA_QUERIES: Record<string, string> = {
  tables: `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`,
  columns: `select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' order by 1,2`,
  enums: `select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) labels from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by 1 order by 1`,
  constraints: `select conrelid::regclass::text tbl, conname, pg_get_constraintdef(oid) def from pg_constraint where connamespace='public'::regnamespace order by 1,2`,
  indexes: `select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2`,
  policies: `select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public' order by 1,2`,
  triggers: `select event_object_table tbl, trigger_name, event_manipulation, action_timing, action_statement from information_schema.triggers where trigger_schema in ('public','auth') order by 1,2,3`,
  functions: `select p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`,
};

async function backup() {
  const { url, label } = resolveUrl();
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join('backups', `${label}-${stamp}`);
  mkdirSync(dir, { recursive: true });

  const schema: Record<string, unknown> = {};
  for (const [name, query] of Object.entries(SCHEMA_QUERIES)) {
    schema[name] = await sql.unsafe(query);
  }
  writeFileSync(join(dir, 'schema.json'), JSON.stringify(schema, null, 1));

  const tables = (schema.tables as { table_name: string }[]).map((t) => t.table_name);
  const summary: Record<string, number> = {};
  for (const table of tables) {
    const rows = await sql.unsafe(`select * from "${table}"`);
    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 1));
    summary[table] = rows.length;
  }
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({ label, takenAt: new Date().toISOString(), rows: summary }, null, 1)
  );
  await sql.end();

  console.log(`Backup written to ${dir}`);
  for (const [table, n] of Object.entries(summary)) {
    console.log(`  ${table.padEnd(32)} ${String(n).padStart(6)} rows`);
  }
}

async function restore(dir: string) {
  if (!existsSync(dir)) throw new Error(`Backup folder not found: ${dir}`);
  const { url, label } = resolveUrl();
  if (label === 'production') {
    console.log('Restoring into PRODUCTION. Existing rows are kept; only missing rows are inserted.');
  }
  // Trigger notices (for example the competitions Vault warning) are not errors; keep the output readable.
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30, onnotice: () => {} });

  const present = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !['schema.json', 'manifest.json'].includes(f))
    .map((f) => f.replace(/\.json$/, ''));
  const ordered = [
    ...RESTORE_ORDER.filter((t) => present.includes(t)),
    ...present.filter((t) => !RESTORE_ORDER.includes(t)),
  ];

  for (const table of ordered) {
    const rows = JSON.parse(readFileSync(join(dir, `${table}.json`), 'utf8')) as Record<
      string,
      unknown
    >[];
    if (rows.length === 0) {
      console.log(`  ${table.padEnd(32)} nothing to restore`);
      continue;
    }
    let inserted = 0;
    for (const row of rows) {
      const result = await sql`insert into ${sql(table)} ${sql(row)} on conflict do nothing`;
      inserted += result.count;
    }
    console.log(`  ${table.padEnd(32)} ${inserted}/${rows.length} rows inserted`);
  }
  await sql.end();
  console.log('Restore finished.');
}

(restoreDir ? restore(restoreDir) : backup()).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
