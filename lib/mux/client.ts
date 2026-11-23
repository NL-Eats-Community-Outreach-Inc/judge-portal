import 'server-only';

import Mux from '@mux/mux-node';

const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;
const jwtPrivateKey = process.env.MUX_SIGNING_KEY_PRIVATE;

if (!tokenId || !tokenSecret) {
  throw new Error('Missing Mux API credentials');
}

if (!jwtPrivateKey) {
  throw new Error('Missing MUX_SIGNING_KEY_PRIVATE');
}

export const mux = new Mux({
  tokenId,
  tokenSecret,
  jwtPrivateKey,
});
