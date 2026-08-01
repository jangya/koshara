import {auth, clerkClient, currentUser} from '@clerk/nextjs/server';
import {
  assertHouseholdAccess,
  isEmailAllowed,
  isHouseholdRole,
  type HouseholdAccessContext,
} from '@koshara/domain';
import {
  createHousehold,
  ensureLinkedPerson,
  findHouseholdByClerkOrganizationId,
  type Household,
} from '@koshara/database';

import {getDatabase} from './database';
import {getServerEnvironment} from './environment';

export class AuthenticationRequiredError extends Error {}
export class EmailNotAllowedError extends Error {}
export class HouseholdRequiredError extends Error {}

export type AllowedUser = {
  clerkUserId: string;
  displayName: string;
  emailAddresses: string[];
};

export type AuthorizedHousehold = HouseholdAccessContext & {
  household: Household;
  user: AllowedUser;
};

export async function requireAllowedUser(): Promise<AllowedUser> {
  const session = await auth();
  if (!session.isAuthenticated || !session.userId) {
    throw new AuthenticationRequiredError('Authentication is required');
  }

  const user = await currentUser();
  if (!user) {
    throw new AuthenticationRequiredError('Authenticated user could not be loaded');
  }

  const emailAddresses = user.emailAddresses
    .filter((email) => email.verification?.status === 'verified')
    .map((email) => email.emailAddress);
  if (!isEmailAllowed(emailAddresses, getServerEnvironment().allowedEmails)) {
    throw new EmailNotAllowedError('This email address is not allowed to use this private application');
  }

  return {
    clerkUserId: session.userId,
    displayName: user.fullName ?? user.firstName ?? emailAddresses[0] ?? 'Household member',
    emailAddresses,
  };
}

export async function requireHouseholdAccess(requiredRole: 'owner' | 'member' = 'member'):
Promise<AuthorizedHousehold> {
  const user = await requireAllowedUser();
  const session = await auth();
  const organizationId = session.orgId;
  const role = session.orgRole;

  if (!organizationId || !isHouseholdRole(role)) {
    throw new HouseholdRequiredError('An active household is required');
  }

  const database = getDatabase();
  let household = await findHouseholdByClerkOrganizationId(database, organizationId);

  if (!household) {
    if (role !== 'org:admin') {
      throw new HouseholdRequiredError('The household owner must finish household setup');
    }

    const client = await clerkClient();
    const organization = await client.organizations.getOrganization({organizationId});
    household = await createHousehold(database, {
      clerkOrganizationId: organizationId,
      name: organization.name,
      createdByClerkUserId: user.clerkUserId,
    });
  }

  await ensureLinkedPerson(database, household.id, {
    linkedClerkUserId: user.clerkUserId,
    displayName: user.displayName,
  });

  const access = assertHouseholdAccess({
    identity: {
      clerkUserId: user.clerkUserId,
      clerkOrganizationId: organizationId,
      role,
      allowedEmail: true,
    },
    household,
    requiredRole,
  });

  return {...access, household, user};
}
