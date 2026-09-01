import {describe, expect, it} from 'vitest';

import {createContentSecurityPolicy} from '../../next.config';

describe('createContentSecurityPolicy', () => {
  it('allows WebSockets only on local development hosts', () => {
    const developmentPolicy = createContentSecurityPolicy('development');

    expect(developmentPolicy).toContain("connect-src 'self' ws://localhost:* ws://127.0.0.1:*");
  });

  it('does not allow WebSocket schemes in production', () => {
    const productionPolicy = createContentSecurityPolicy('production');

    expect(productionPolicy).toContain("connect-src 'self'");
    expect(productionPolicy).not.toMatch(/connect-src[^;]*\b(?:ws|wss):/);
  });
});
