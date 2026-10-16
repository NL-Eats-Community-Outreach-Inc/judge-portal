import 'server-only';

import { createClient } from 'next-sanity';

export const sanityServerClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2026-10-07',
  token: process.env.SANITY_API_READ_TOKEN,
  useCdn: false,
});
