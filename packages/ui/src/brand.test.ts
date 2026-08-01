import {describe, expect, it} from 'vitest';

import {defaultBrand, resolveBrand} from './brand';

describe('resolveBrand', () => {
  it('uses Koshara defaults without coupling callers to literal branding', () => {
    expect(defaultBrand).toEqual({
      applicationName: 'Koshara',
      shortName: 'Koshara',
      tagline: 'Every account. One household view.',
    });
  });

  it('supports a complete customer-facing brand override', () => {
    expect(resolveBrand({applicationName: 'Home Ledger', shortName: 'Ledger'})).toMatchObject({
      applicationName: 'Home Ledger',
      shortName: 'Ledger',
      tagline: defaultBrand.tagline,
    });
  });
});
