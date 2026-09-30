#!/usr/bin/env tsx
// Compares schema objects between DATABASE_URL and COMPARE_DATABASE_URL. Read-only.
// Usage: COMPARE_DATABASE_URL='postgres://…' npx tsx scripts/compare-databases.ts
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
const a = process.env.DATABASE_URL;
const b = process.env.COMPARE_DATABASE_URL;
if (!a || !b) throw new Error('DATABASE_URL and COMPARE_DATABASE_URL are required');

const queries: Record<string, string> = {
  tables: `select table_name k, table_name v from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`,
  columns: `select table_name||'.'||column_name k, data_type||'|'||is_nullable||'|'||coalesce(column_default,'') v from information_schema.columns where table_schema='public'`,
  enums: `select t.typname k, string_agg(e.enumlabel, ',' order by e.enumsortorder) v from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by 1`,
  constraints: `select conrelid::regclass::text||':'||pg_get_constraintdef(oid) k, conname v from pg_constraint where connamespace='public'::regnamespace`,
  indexes: `select indexname k, indexdef v from pg_indexes where schemaname='public'`,
  policies: `select tablename||':'||policyname k, cmd||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'') v from pg_policies where schemaname='public'`,
  triggers: `select event_object_table||':'||trigger_name||':'||event_manipulation k, action_timing||' '||action_statement v from information_schema.triggers where trigger_schema in ('public','auth')`,
  functions: `select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' k, regexp_replace(pg_get_functiondef(p.oid), '\\s+', ' ', 'g') v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`,
};

async function snapshot(url: string) {
  const sql = postgres(url, { max: 1, prepare: false });
  const out: Record<string, Map<string, string>> = {};
  for (const [name, q] of Object.entries(queries)) {
    out[name] = new Map((await sql.unsafe(q)).map((r) => [String(r.k), String(r.v)]));
  }
  await sql.end();
  return out;
}

async function main() {
  const [left, right] = await Promise.all([snapshot(a!), snapshot(b!)]);
  let differences = 0;
  for (const name of Object.keys(queries)) {
    const l = left[name],
      r = right[name];
    const onlyLeft = [...l.keys()].filter((k) => !r.has(k));
    const onlyRight = [...r.keys()].filter((k) => !l.has(k));
    const changed = [...l.keys()].filter((k) => r.has(k) && l.get(k) !== r.get(k));
    differences += onlyLeft.length + onlyRight.length + changed.length;
    console.log(`\n== ${name}: ${l.size} vs ${r.size}`);
    onlyLeft.forEach((k) => console.log(`  only in DATABASE_URL:         ${k}`));
    onlyRight.forEach((k) => console.log(`  only in COMPARE_DATABASE_URL: ${k}`));
    changed.forEach((k) => console.log(`  differs: ${k}\n     ${l.get(k)}\n     ${r.get(k)}`));
  }
  console.log(`\n${differences} difference(s)`);
  process.exit(differences === 0 ? 0 : 2);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
