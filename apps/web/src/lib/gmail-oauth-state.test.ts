import {describe, expect, it} from 'vitest';

import {GMAIL_READONLY_SCOPE} from './google-oauth';
import {
  assertOAuthStateCookie,
  createGoogleOAuthStateMaterial,
  decryptGoogleOAuthCodeVerifier,
  parseGoogleOAuthCallback,
} from './gmail-oauth-state';

const householdId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const key = new Uint8Array(Buffer.alloc(32, 5));
const redirectUri = 'https://koshara.example/gmail/oauth/callback';

describe('strict Gmail OAuth state and callback validation', () => {
  it('creates non-guessable state and a context-bound encrypted PKCE verifier', () => {
    const material = createGoogleOAuthStateMaterial(householdId, key);
    expect(material.state).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(material.stateDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(material.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(material.encryptedCodeVerifier).not.toContain(material.codeVerifier);
    expect(decryptGoogleOAuthCodeVerifier(
      material.encryptedCodeVerifier,
      householdId,
      material.stateDigest,
      key,
    )).toBe(material.codeVerifier);
  });

  it('accepts one exact callback code and validates the optional returned scope', () => {
    const state = 's'.repeat(43);
    const url = new URL(redirectUri);
    url.search = new URLSearchParams({code: 'synthetic-code', state, scope: GMAIL_READONLY_SCOPE}).toString();

    expect(parseGoogleOAuthCallback(url, redirectUri)).toEqual({kind: 'code', code: 'synthetic-code', state});
    expect(() => assertOAuthStateCookie(state, state)).not.toThrow();
  });

  it('rejects redirect changes, duplicate or unknown fields, extra scopes, and cookie mismatch', () => {
    const state = 's'.repeat(43);
    expect(() => parseGoogleOAuthCallback(
      new URL(`https://attacker.example/gmail/oauth/callback?code=x&state=${state}`),
      redirectUri,
    )).toThrow('invalid');
    expect(() => parseGoogleOAuthCallback(
      new URL(`https://user:password@koshara.example/gmail/oauth/callback?code=x&state=${state}`),
      redirectUri,
    )).toThrow('invalid');
    expect(() => parseGoogleOAuthCallback(
      new URL(`${redirectUri}?code=x&code=y&state=${state}`),
      redirectUri,
    )).toThrow('invalid');
    expect(() => parseGoogleOAuthCallback(
      new URL(`${redirectUri}?code=x&state=${state}&unexpected=value`),
      redirectUri,
    )).toThrow('invalid');
    expect(() => parseGoogleOAuthCallback(
      new URL(`${redirectUri}?code=x&state=${state}&scope=${encodeURIComponent(`${GMAIL_READONLY_SCOPE} https://www.googleapis.com/auth/gmail.modify`)}`),
      redirectUri,
    )).toThrow('invalid');
    expect(() => assertOAuthStateCookie(state, 'different'.padEnd(43, 'x'))).toThrow('invalid');
  });

  it('maps a provider cancellation without returning provider details', () => {
    const state = 's'.repeat(43);
    expect(parseGoogleOAuthCallback(
      new URL(`${redirectUri}?error=access_denied&error_description=private-provider-detail&state=${state}`),
      redirectUri,
    )).toEqual({kind: 'cancelled', state});
  });
});
