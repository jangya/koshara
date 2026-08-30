import {describe, expect, it, vi} from 'vitest';

import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  GMAIL_READONLY_SCOPE,
  GoogleOAuthError,
} from './google-oauth';

const environment = {
  GOOGLE_CLIENT_ID: 'synthetic-client.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'synthetic-client-secret',
  GOOGLE_OAUTH_REDIRECT_URI: 'https://koshara.example/gmail/oauth/callback',
};

describe('Google OAuth web-server flow', () => {
  it('builds a separate offline, consented, read-only Gmail authorization request', () => {
    const url = buildGoogleAuthorizationUrl({
      environment,
      state: 'state_'.padEnd(48, 'x'),
      codeChallenge: 'challenge_'.padEnd(48, 'y'),
      loginHint: 'member@example.com',
    });

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      access_type: 'offline',
      client_id: environment.GOOGLE_CLIENT_ID,
      code_challenge_method: 'S256',
      include_granted_scopes: 'false',
      login_hint: 'member@example.com',
      prompt: 'consent',
      redirect_uri: environment.GOOGLE_OAUTH_REDIRECT_URI,
      response_type: 'code',
      scope: GMAIL_READONLY_SCOPE,
    });
  });

  it('exchanges a bounded code using the exact redirect and PKCE verifier', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe('error');
      expect(init?.body?.toString()).toBe(new URLSearchParams({
        client_id: environment.GOOGLE_CLIENT_ID,
        client_secret: environment.GOOGLE_CLIENT_SECRET,
        code: 'synthetic-authorization-code',
        code_verifier: 'verifier_'.padEnd(48, 'v'),
        grant_type: 'authorization_code',
        redirect_uri: environment.GOOGLE_OAUTH_REDIRECT_URI,
      }).toString());
      return Response.json({
        access_token: 'synthetic-access-token',
        expires_in: 3600,
        refresh_token: 'synthetic-refresh-token',
        scope: GMAIL_READONLY_SCOPE,
        token_type: 'Bearer',
      });
    });

    await expect(exchangeGoogleAuthorizationCode({
      code: 'synthetic-authorization-code',
      codeVerifier: 'verifier_'.padEnd(48, 'v'),
      environment,
      fetchImpl,
    })).resolves.toMatchObject({refreshToken: 'synthetic-refresh-token'});
  });

  it('fails closed for missing refresh tokens, extra scopes, and provider errors', async () => {
    const responses = [
      Response.json({access_token: 'access', expires_in: 3600, scope: GMAIL_READONLY_SCOPE, token_type: 'Bearer'}),
      Response.json({
        access_token: 'access', expires_in: 3600, refresh_token: 'refresh',
        scope: `${GMAIL_READONLY_SCOPE} https://www.googleapis.com/auth/gmail.modify`, token_type: 'Bearer',
      }),
      Response.json({error: 'secret_provider_detail'}, {status: 400}),
    ];

    for (const response of responses) {
      const operation = exchangeGoogleAuthorizationCode({
        code: 'synthetic-code',
        codeVerifier: 'verifier_'.padEnd(48, 'v'),
        environment,
        fetchImpl: vi.fn(async () => response),
      });
      await expect(operation).rejects.toEqual(new GoogleOAuthError(
        'OAUTH_EXCHANGE_FAILED',
        'The Gmail connection could not be completed',
      ));
      await expect(operation).rejects.not.toThrow('secret_provider_detail');
    }
  });
});
