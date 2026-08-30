import {randomUUID} from 'node:crypto';

import {describe, expect, it, vi} from 'vitest';

import {GMAIL_READONLY_SCOPE} from './google-oauth';
import {
  completeGmailOAuthConnection,
  GmailConnectionError,
  getUsableGmailAccessToken,
} from './gmail-connection-service';
import {encryptGmailToken} from './gmail-token-crypto';

const householdId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const connectionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const encryptionKey = new Uint8Array(Buffer.alloc(32, 9));
const environment = {
  GOOGLE_CLIENT_ID: 'synthetic.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'synthetic-client-secret',
  GOOGLE_OAUTH_REDIRECT_URI: 'https://koshara.example/gmail/oauth/callback',
};

function envelope(token: string, tokenKind: 'access' | 'refresh') {
  return encryptGmailToken(token, encryptionKey, {householdId, connectionId, tokenKind});
}

describe('Gmail connection service', () => {
  it('decrypts a still-valid access token without refreshing it', async () => {
    const updateAccessToken = vi.fn();
    await expect(getUsableGmailAccessToken({
      householdId,
      connection: {
        id: connectionId,
        encryptedAccessToken: envelope('stored-access-token', 'access'),
        encryptedRefreshToken: envelope('stored-refresh-token', 'refresh'),
        accessTokenExpiresAt: new Date(Date.now() + 5 * 60_000),
        disconnectedAt: null,
      },
      encryptionKey,
      environment,
      updateAccessToken,
    })).resolves.toBe('stored-access-token');
    expect(updateAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes an expired token and only forwards a new encrypted access token to persistence', async () => {
    const updateAccessToken = vi.fn(async (value: {encryptedAccessToken: string; accessTokenExpiresAt: Date}) => {
      expect(value).toBeDefined();
    });
    const fetchImpl = vi.fn(async () => Response.json({
      access_token: 'new-access-token',
      expires_in: 3600,
      scope: GMAIL_READONLY_SCOPE,
      token_type: 'Bearer',
    }));
    await expect(getUsableGmailAccessToken({
      householdId,
      connection: {
        id: connectionId,
        encryptedAccessToken: envelope('expired-access-token', 'access'),
        encryptedRefreshToken: envelope('stored-refresh-token', 'refresh'),
        accessTokenExpiresAt: new Date(Date.now() - 1_000),
        disconnectedAt: null,
      },
      encryptionKey,
      environment,
      updateAccessToken,
      fetchImpl,
    })).resolves.toBe('new-access-token');
    const persisted = updateAccessToken.mock.calls[0]![0];
    expect(persisted.encryptedAccessToken).not.toContain('new-access-token');
    expect(JSON.stringify(persisted)).not.toContain('stored-refresh-token');
  });

  it('validates the Gmail profile against the authenticated Clerk user before saving credentials', async () => {
    const saveConnection = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async (rawUrl: string | URL | Request) => {
      const url = String(rawUrl);
      if (url.includes('/token')) return Response.json({
        access_token: 'new-access-token',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
        scope: GMAIL_READONLY_SCOPE,
        token_type: 'Bearer',
      });
      return Response.json({emailAddress: 'member@example.com'});
    });

    await expect(completeGmailOAuthConnection({
      householdId,
      connectionId,
      clerkUserId: 'user_member',
      verifiedClerkEmails: ['member@example.com'],
      code: 'synthetic-code',
      codeVerifier: 'verifier_'.padEnd(48, 'v'),
      encryptionKey,
      environment,
      fetchImpl,
      saveConnection,
    })).resolves.toBe('member@example.com');
    expect(saveConnection).toHaveBeenCalledWith(expect.objectContaining({
      id: connectionId,
      emailAddress: 'member@example.com',
      encryptedAccessToken: expect.not.stringContaining('new-access-token'),
      encryptedRefreshToken: expect.not.stringContaining('new-refresh-token'),
    }));
  });

  it('revokes mismatched account credentials and never exposes tokens or provider details', async () => {
    const saveConnection = vi.fn();
    const fetchImpl = vi.fn(async (rawUrl: string | URL | Request) => {
      const url = String(rawUrl);
      if (url.includes('/token')) return Response.json({
        access_token: 'secret-access-token',
        expires_in: 3600,
        refresh_token: 'secret-refresh-token',
        scope: GMAIL_READONLY_SCOPE,
        token_type: 'Bearer',
      });
      if (url.includes('/profile')) return Response.json({emailAddress: 'different@example.com'});
      return new Response(null, {status: 200});
    });
    const operation = completeGmailOAuthConnection({
      householdId,
      connectionId: randomUUID(),
      clerkUserId: 'user_member',
      verifiedClerkEmails: ['member@example.com'],
      code: 'synthetic-code',
      codeVerifier: 'verifier_'.padEnd(48, 'v'),
      encryptionKey,
      environment,
      fetchImpl,
      saveConnection,
    });

    await expect(operation).rejects.toEqual(new GmailConnectionError(
      'GMAIL_ACCOUNT_MISMATCH',
      'Connect the same verified Google address used for this Koshara account',
    ));
    await expect(operation).rejects.not.toThrow('secret-access-token');
    await expect(operation).rejects.not.toThrow('secret-refresh-token');
    expect(saveConnection).not.toHaveBeenCalled();
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('/revoke'))).toBe(true);
  });
});
