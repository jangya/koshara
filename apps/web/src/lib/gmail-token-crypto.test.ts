import {randomBytes} from 'node:crypto';

import {describe, expect, it} from 'vitest';

import {decryptGmailToken, encryptGmailToken} from './gmail-token-crypto';

const key = randomBytes(32);
const context = {
  householdId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  connectionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tokenKind: 'refresh' as const,
};

describe('Gmail token encryption', () => {
  it('round-trips a token without including plaintext in the stored envelope', () => {
    const token = 'synthetic_refresh_token_value';
    const encrypted = encryptGmailToken(token, key, context);

    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
    expect(encrypted).not.toContain(token);
    expect(decryptGmailToken(encrypted, key, context)).toBe(token);
  });

  it('uses a distinct random nonce for every encryption', () => {
    expect(encryptGmailToken('same-token', key, context)).not.toBe(
      encryptGmailToken('same-token', key, context),
    );
  });

  it('rejects tampering and credentials moved to a different household or token field', () => {
    const encrypted = encryptGmailToken('synthetic_access_token', key, context);
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;

    expect(() => decryptGmailToken(tampered, key, context)).toThrow('credential could not be decrypted');
    expect(() => decryptGmailToken(encrypted, key, {...context, householdId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}))
      .toThrow('credential could not be decrypted');
    expect(() => decryptGmailToken(encrypted, key, {...context, tokenKind: 'access'}))
      .toThrow('credential could not be decrypted');
  });

  it('rejects malformed keys and envelopes without exposing their values', () => {
    expect(() => encryptGmailToken('token', randomBytes(31), context)).toThrow('encryption key');
    expect(() => decryptGmailToken('not-an-envelope', key, context)).toThrow('credential could not be decrypted');
  });
});
