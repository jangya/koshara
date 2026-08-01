import {describe, expect, it} from 'vitest';

import {
  AccessError,
  assertHouseholdAccess,
  isHouseholdRole,
  parseAllowedEmails,
} from './access';

describe('parseAllowedEmails', () => {
  it('normalises, trims, and de-duplicates addresses', () => {
    expect(parseAllowedEmails(' One@Example.com, two@example.com,one@example.com ')).toEqual([
      'one@example.com',
      'two@example.com',
    ]);
  });

  it('rejects an empty allow-list', () => {
    expect(() => parseAllowedEmails(' , ')).toThrow('At least one allowed email is required');
  });

  it('rejects malformed allow-list entries', () => {
    expect(() => parseAllowedEmails('not-an-email')).toThrow();
  });
});

describe('isHouseholdRole', () => {
  it('accepts only the two configured Clerk organisation roles', () => {
    expect(isHouseholdRole('org:admin')).toBe(true);
    expect(isHouseholdRole('org:member')).toBe(true);
    expect(isHouseholdRole('org:viewer')).toBe(false);
    expect(isHouseholdRole(undefined)).toBe(false);
  });
});

describe('assertHouseholdAccess', () => {
  const member = {
    clerkUserId: 'user_1',
    clerkOrganizationId: 'org_1',
    role: 'org:member' as const,
    allowedEmail: true,
  };

  it('returns a household-scoped context for a member', () => {
    expect(
      assertHouseholdAccess({
        identity: member,
        household: {id: 'household_1', clerkOrganizationId: 'org_1'},
        resourceHouseholdId: 'household_1',
      }),
    ).toEqual({
      clerkUserId: 'user_1',
      householdId: 'household_1',
      clerkOrganizationId: 'org_1',
      role: 'org:member',
    });
  });

  it('rejects an email that is not allow-listed', () => {
    expect(() =>
      assertHouseholdAccess({
        identity: {...member, allowedEmail: false},
        household: {id: 'household_1', clerkOrganizationId: 'org_1'},
      }),
    ).toThrowError(new AccessError('EMAIL_NOT_ALLOWED'));
  });

  it('rejects an organization-to-household mismatch', () => {
    expect(() =>
      assertHouseholdAccess({
        identity: member,
        household: {id: 'household_1', clerkOrganizationId: 'org_other'},
      }),
    ).toThrowError(new AccessError('HOUSEHOLD_MISMATCH'));
  });

  it('rejects a row from another household', () => {
    expect(() =>
      assertHouseholdAccess({
        identity: member,
        household: {id: 'household_1', clerkOrganizationId: 'org_1'},
        resourceHouseholdId: 'household_2',
      }),
    ).toThrowError(new AccessError('HOUSEHOLD_MISMATCH'));
  });

  it('enforces owner-only operations', () => {
    expect(() =>
      assertHouseholdAccess({
        identity: member,
        household: {id: 'household_1', clerkOrganizationId: 'org_1'},
        requiredRole: 'owner',
      }),
    ).toThrowError(new AccessError('ROLE_REQUIRED'));
  });
});
