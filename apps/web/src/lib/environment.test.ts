import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  getDocumentStorageEnvironment,
  getGmailEnvironment,
  getR2Environment,
  getServerEnvironment,
  isAuthenticationConfigured,
} from './environment';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server environment', () => {
  it('normalises the private email allow-list', () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'test_secret');
    vi.stubEnv('ALLOWED_USER_EMAILS', ' One@example.com, two@example.com ');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost:5432/koshara');

    expect(getServerEnvironment().allowedEmails).toEqual(['one@example.com', 'two@example.com']);
  });

  it('fails closed when required server configuration is absent', () => {
    vi.stubEnv('CLERK_SECRET_KEY', '');
    vi.stubEnv('ALLOWED_USER_EMAILS', '');
    vi.stubEnv('DATABASE_URL', '');

    expect(() => getServerEnvironment()).toThrow();
  });

  it('requires both public and secret Clerk keys before enabling authentication UI', () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_example');
    vi.stubEnv('CLERK_SECRET_KEY', '');
    expect(isAuthenticationConfigured()).toBe(false);

    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example');
    expect(isAuthenticationConfigured()).toBe(true);
  });

  it('accepts only the configured account R2 endpoint and a private bucket credential set', () => {
    vi.stubEnv('R2_ACCOUNT_ID', 'a'.repeat(32));
    vi.stubEnv('R2_ACCESS_KEY_ID', 'test_access_key');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test_secret_key');
    vi.stubEnv('R2_BUCKET_NAME', 'koshara-private-statements');
    vi.stubEnv('R2_ENDPOINT', `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`);

    expect(getR2Environment()).toMatchObject({R2_BUCKET_NAME: 'koshara-private-statements'});
    vi.stubEnv('R2_ENDPOINT', 'https://example.com');
    expect(() => getR2Environment()).toThrow('R2_ENDPOINT');
  });

  it('validates every R2 variable when the R2 document driver is selected', () => {
    vi.stubEnv('DOCUMENT_STORAGE_DRIVER', 'r2');
    const validEnvironment = {
      R2_ACCOUNT_ID: 'a'.repeat(32),
      R2_ACCESS_KEY_ID: 'test_access_key',
      R2_SECRET_ACCESS_KEY: 'test_secret_key',
      R2_BUCKET_NAME: 'koshara-private-statements',
      R2_ENDPOINT: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`,
    };

    for (const [name, value] of Object.entries(validEnvironment)) vi.stubEnv(name, value);
    expect(getDocumentStorageEnvironment()).toMatchObject({DOCUMENT_STORAGE_DRIVER: 'r2'});

    for (const name of Object.keys(validEnvironment)) {
      vi.stubEnv(name, '');
      expect(() => getDocumentStorageEnvironment()).toThrow(name);
      vi.stubEnv(name, validEnvironment[name as keyof typeof validEnvironment]);
    }
  });

  it('resolves the local path absolutely and rejects public or source locations', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DOCUMENT_STORAGE_DRIVER', 'local');
    vi.stubEnv('LOCAL_DOCUMENT_STORAGE_PATH', '.local/private-documents');

    expect(getDocumentStorageEnvironment().LOCAL_DOCUMENT_STORAGE_PATH).toMatch(/^\//u);

    vi.stubEnv('LOCAL_DOCUMENT_STORAGE_PATH', 'public/private-documents');
    expect(() => getDocumentStorageEnvironment()).toThrow('outside tracked, public, and source directories');
    vi.stubEnv('LOCAL_DOCUMENT_STORAGE_PATH', 'src/private-documents');
    expect(() => getDocumentStorageEnvironment()).toThrow('outside tracked, public, and source directories');
    vi.stubEnv('LOCAL_DOCUMENT_STORAGE_PATH', '../../docs/private-documents');
    expect(() => getDocumentStorageEnvironment()).toThrow('outside tracked, public, and source directories');
    vi.stubEnv('LOCAL_DOCUMENT_STORAGE_PATH', '.local/another-directory');
    expect(() => getDocumentStorageEnvironment()).toThrow('outside tracked, public, and source directories');
  });

  it('requires an exact Gmail callback URL and a 256-bit base64 encryption key', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://koshara.example');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'synthetic.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'synthetic-client-secret');
    vi.stubEnv('GOOGLE_OAUTH_REDIRECT_URI', 'https://koshara.example/gmail/oauth/callback');
    vi.stubEnv('GMAIL_TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));

    expect(getGmailEnvironment()).toMatchObject({
      GOOGLE_OAUTH_REDIRECT_URI: 'https://koshara.example/gmail/oauth/callback',
      tokenEncryptionKey: expect.any(Uint8Array),
    });
    expect(getGmailEnvironment().tokenEncryptionKey).toHaveLength(32);

    vi.stubEnv('GOOGLE_OAUTH_REDIRECT_URI', 'https://attacker.example/gmail/oauth/callback');
    expect(() => getGmailEnvironment()).toThrow('GOOGLE_OAUTH_REDIRECT_URI');
    vi.stubEnv('GOOGLE_OAUTH_REDIRECT_URI', 'https://koshara.example/gmail/oauth/callback');
    vi.stubEnv('GMAIL_TOKEN_ENCRYPTION_KEY', Buffer.alloc(31).toString('base64'));
    expect(() => getGmailEnvironment()).toThrow('GMAIL_TOKEN_ENCRYPTION_KEY');
  });
});
