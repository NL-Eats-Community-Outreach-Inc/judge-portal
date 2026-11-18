import 'server-only';

import { createClient } from 'next-sanity';

if (!process.env.SANITY_API_WRITE_TOKEN) {
  throw new Error('Missing SANITY_API_WRITE_TOKEN');
}

export const sanityWriteClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2026-10-07',
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});
