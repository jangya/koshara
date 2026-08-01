export type BrandConfiguration = {
  applicationName: string;
  shortName: string;
  tagline: string;
  logoUrl?: string;
  supportUrl?: string;
  privacyUrl?: string;
};

export const defaultBrand: BrandConfiguration = {
  applicationName: 'Koshara',
  shortName: 'Koshara',
  tagline: 'Every account. One household view.',
};

export function resolveBrand(overrides: Partial<BrandConfiguration> = {}): BrandConfiguration {
  return {...defaultBrand, ...overrides};
}
