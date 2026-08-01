import {afterEach, describe, expect, it, vi} from 'vitest';

import {getServerEnvironment, isAuthenticationConfigured} from './environment';

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
});
