import {z} from 'zod';

export const householdRoles = ['org:admin', 'org:member'] as const;

export type HouseholdRole = (typeof householdRoles)[number];

export function isHouseholdRole(value: string | null | undefined): value is HouseholdRole {
  return householdRoles.some((role) => role === value);
}

export type HouseholdIdentity = {
  clerkUserId: string;
  clerkOrganizationId: string | null;
  role: HouseholdRole | null;
  allowedEmail: boolean;
};

export type HouseholdReference = {
  id: string;
  clerkOrganizationId: string;
};

export type HouseholdAccessContext = {
  clerkUserId: string;
  householdId: string;
  clerkOrganizationId: string;
  role: HouseholdRole;
};

export type AccessErrorCode =
  | 'EMAIL_NOT_ALLOWED'
  | 'HOUSEHOLD_REQUIRED'
  | 'HOUSEHOLD_MISMATCH'
  | 'ROLE_REQUIRED';

export class AccessError extends Error {
  readonly code: AccessErrorCode;

  constructor(code: AccessErrorCode) {
    super(code);
    this.name = 'AccessError';
    this.code = code;
  }
}

export function parseAllowedEmails(value: string): string[] {
  const emails = [...new Set(value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))];

  if (emails.length === 0) {
    throw new Error('At least one allowed email is required');
  }

  return z.array(z.email()).parse(emails);
}

export function isEmailAllowed(emailAddresses: readonly string[], allowedEmails: readonly string[]): boolean {
  const allowed = new Set(allowedEmails.map((email) => email.toLowerCase()));
  return emailAddresses.some((email) => allowed.has(email.toLowerCase()));
}

export function assertHouseholdAccess(input: {
  identity: HouseholdIdentity;
  household: HouseholdReference;
  resourceHouseholdId?: string;
  requiredRole?: 'owner' | 'member';
}): HouseholdAccessContext {
  const {household, identity, requiredRole, resourceHouseholdId} = input;

  if (!identity.allowedEmail) {
    throw new AccessError('EMAIL_NOT_ALLOWED');
  }

  if (!identity.clerkOrganizationId || !identity.role) {
    throw new AccessError('HOUSEHOLD_REQUIRED');
  }

  if (
    identity.clerkOrganizationId !== household.clerkOrganizationId ||
    (resourceHouseholdId !== undefined && resourceHouseholdId !== household.id)
  ) {
    throw new AccessError('HOUSEHOLD_MISMATCH');
  }

  if (requiredRole === 'owner' && identity.role !== 'org:admin') {
    throw new AccessError('ROLE_REQUIRED');
  }

  return {
    clerkUserId: identity.clerkUserId,
    householdId: household.id,
    clerkOrganizationId: household.clerkOrganizationId,
    role: identity.role,
  };
}
