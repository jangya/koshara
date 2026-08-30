import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';

import {z} from 'zod';

import {GMAIL_READONLY_SCOPE} from './google-oauth';
import {decryptGmailToken, encryptGmailToken} from './gmail-token-crypto';

const stateSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
export const gmailOAuthStateCookieName = 'koshara-gmail-oauth-state';
const allowedCallbackFields = new Set([
  'authuser',
  'code',
  'error',
  'error_description',
  'error_uri',
  'hd',
  'prompt',
  'scope',
  'state',
]);

export function createGoogleOAuthStateMaterial(householdId: string, encryptionKey: Uint8Array) {
  const state = randomBytes(32).toString('base64url');
  const stateDigest = createHash('sha256').update(state, 'utf8').digest('hex');
  const codeVerifier = randomBytes(64).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier, 'utf8').digest('base64url');
  return {
    state,
    stateDigest,
    codeVerifier,
    codeChallenge,
    encryptedCodeVerifier: encryptGmailToken(codeVerifier, encryptionKey, {
      householdId,
      connectionId: stateDigest,
      tokenKind: 'oauth-code-verifier',
    }),
  };
}

export function decryptGoogleOAuthCodeVerifier(
  encryptedCodeVerifier: string,
  householdId: string,
  stateDigest: string,
  encryptionKey: Uint8Array,
) {
  return decryptGmailToken(encryptedCodeVerifier, encryptionKey, {
    householdId,
    connectionId: stateDigest,
    tokenKind: 'oauth-code-verifier',
  });
}

export function digestGoogleOAuthState(state: string) {
  return createHash('sha256').update(stateSchema.parse(state), 'utf8').digest('hex');
}

export function assertOAuthStateCookie(callbackState: string, cookieState: string | undefined) {
  try {
    const left = Buffer.from(stateSchema.parse(callbackState), 'utf8');
    const right = Buffer.from(stateSchema.parse(cookieState), 'utf8');
    if (left.byteLength !== right.byteLength || !timingSafeEqual(left, right)) throw new Error('mismatch');
  } catch {
    throw new Error('The Gmail OAuth state is invalid');
  }
}

export type ParsedGoogleOAuthCallback =
  | {kind: 'code'; code: string; state: string}
  | {kind: 'cancelled'; state: string};

export function parseGoogleOAuthCallback(callbackUrl: URL, expectedRedirectUri: string): ParsedGoogleOAuthCallback {
  try {
    const expected = new URL(expectedRedirectUri);
    if (
      expected.search
      || expected.hash
      || callbackUrl.origin !== expected.origin
      || callbackUrl.pathname !== expected.pathname
      || callbackUrl.username
      || callbackUrl.password
      || callbackUrl.hash
    ) throw new Error('redirect mismatch');
    for (const key of callbackUrl.searchParams.keys()) {
      if (!allowedCallbackFields.has(key) || callbackUrl.searchParams.getAll(key).length !== 1) {
        throw new Error('unexpected callback field');
      }
    }
    const state = stateSchema.parse(callbackUrl.searchParams.get('state'));
    const code = callbackUrl.searchParams.get('code');
    const providerError = callbackUrl.searchParams.get('error');
    if (Boolean(code) === Boolean(providerError)) throw new Error('callback result missing or ambiguous');
    const returnedScope = callbackUrl.searchParams.get('scope');
    if (returnedScope !== null && returnedScope !== GMAIL_READONLY_SCOPE) throw new Error('scope mismatch');
    const authUser = callbackUrl.searchParams.get('authuser');
    if (authUser !== null) z.string().regex(/^\d{1,3}$/u).parse(authUser);
    const prompt = callbackUrl.searchParams.get('prompt');
    if (prompt !== null) z.string().regex(/^[A-Za-z_]{1,32}$/u).parse(prompt);
    const hostedDomain = callbackUrl.searchParams.get('hd');
    if (hostedDomain !== null) z.string().min(1).max(253).parse(hostedDomain);
    const errorDescription = callbackUrl.searchParams.get('error_description');
    if (errorDescription !== null) z.string().max(1_024).parse(errorDescription);
    const errorUri = callbackUrl.searchParams.get('error_uri');
    if (errorUri !== null) z.string().max(2_048).parse(errorUri);

    if (providerError) {
      z.string().regex(/^[A-Za-z0-9._-]{1,128}$/u).parse(providerError);
      return {kind: 'cancelled', state};
    }
    return {kind: 'code', code: z.string().min(1).max(4_096).parse(code), state};
  } catch {
    throw new Error('The Gmail OAuth callback is invalid');
  }
}
