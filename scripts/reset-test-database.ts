#!/usr/bin/env tsx
/**
 * Resets the TEST project so `npm run db:setup:seed && npm run db:update`
 * rebuilds it from nothing: drops and recreates the public schema with the
 * privileges Supabase expects, then deletes every auth user. It refuses to
 * run against any other project.
 *
 * Usage: npm run db:reset:test   (then npm run db:setup:seed && npm run db:update)
 */
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const TEST_PROJECT_REF = 'lqqmxxbxvsnoivebdywb';
const url = process.env.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL is missing from .env.local');
  process.exit(1);
}
if (!url.includes(TEST_PROJECT_REF)) {
  console.error(`Refusing: DATABASE_URL does not point at the test project (${TEST_PROJECT_REF})`);
  process.exit(1);
}

async function main() {
  const sql = postgres(url!, { max: 1, prepare: false, connect_timeout: 20 });
  try {
    const [{ count: usersBefore }] = await sql`select count(*)::int as count from auth.users`;
    const [{ count: tablesBefore }] =
      await sql`select count(*)::int as count from information_schema.tables where table_schema = 'public'`;
    console.log(`before: ${tablesBefore} public tables, ${usersBefore} auth users`);

    await sql.unsafe(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public AUTHORIZATION pg_database_owner;
      GRANT USAGE ON SCHEMA public TO PUBLIC;
      GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
        GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
        GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
        GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
    `);
    await sql`DELETE FROM auth.users`;

    const [{ count: usersAfter }] = await sql`select count(*)::int as count from auth.users`;
    const [{ count: tablesAfter }] =
      await sql`select count(*)::int as count from information_schema.tables where table_schema = 'public'`;
    console.log(`after: ${tablesAfter} public tables, ${usersAfter} auth users`);
    console.log('Next: npm run db:setup:seed && npm run db:update');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
