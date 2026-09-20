import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// drizzle-kit introspects every table at once over a single connection. Through
// the Supabase transaction pooler (port 6543) those pipelined queries can get
// each other's rows back and `push` crashes while pulling the schema, so
// drizzle-kit uses the session pooler (same host, port 5432). The app itself
// keeps DATABASE_URL as given.
function sessionPoolerUrl(url: string): string {
  return url.replace(/(@[^/?#]*\.pooler\.supabase\.com):6543(?=\/|\?|$)/, '$1:5432');
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: sessionPoolerUrl(process.env.DATABASE_URL!),
  },
  verbose: true,
  strict: true,
});
