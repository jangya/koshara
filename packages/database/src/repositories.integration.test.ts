import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  createFinancialAccount,
  createHousehold,
  createPerson,
  ensureLinkedPerson,
  listFinancialAccounts,
  listPeople,
} from './repositories';
import type {KosharaDatabase} from './client';
import * as schema from './schema';

describe('household-scoped repositories', () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;
  let repositoryDatabase: KosharaDatabase;

  beforeEach(async () => {
    client = new PGlite();
    database = drizzle(client, {schema});
    repositoryDatabase = database as unknown as KosharaDatabase;
    await migrate(database, {migrationsFolder: new URL('../drizzle', import.meta.url).pathname});
  });

  afterEach(async () => {
    await client.close();
  });

  it('isolates people and accounts by household', async () => {
    const alpha = await createHousehold(repositoryDatabase, {
      clerkOrganizationId: 'org_alpha',
      name: 'Alpha household',
      createdByClerkUserId: 'user_alpha',
    });
    const beta = await createHousehold(repositoryDatabase, {
      clerkOrganizationId: 'org_beta',
      name: 'Beta household',
      createdByClerkUserId: 'user_beta',
    });
    const alphaPerson = await createPerson(repositoryDatabase, alpha.id, {
      displayName: 'Alpha person',
      type: 'member',
    });
    await createPerson(repositoryDatabase, beta.id, {displayName: 'Beta person', type: 'member'});

    await createFinancialAccount(repositoryDatabase, alpha.id, {
      institutionName: 'Example Bank',
      displayName: 'Alpha savings',
      accountType: 'savings',
      maskedReference: undefined,
      currency: 'INR',
      primaryPersonId: alphaPerson.id,
      joint: false,
      additionalPersonIds: [],
    });

    await expect(listPeople(repositoryDatabase, alpha.id)).resolves.toHaveLength(1);
    await expect(listPeople(repositoryDatabase, beta.id)).resolves.toMatchObject([{displayName: 'Beta person'}]);
    await expect(listFinancialAccounts(repositoryDatabase, beta.id)).resolves.toEqual([]);
  });

  it('rejects an account whose primary person belongs to another household', async () => {
    const alpha = await createHousehold(repositoryDatabase, {
      clerkOrganizationId: 'org_alpha',
      name: 'Alpha household',
      createdByClerkUserId: 'user_alpha',
    });
    const beta = await createHousehold(repositoryDatabase, {
      clerkOrganizationId: 'org_beta',
      name: 'Beta household',
      createdByClerkUserId: 'user_beta',
    });
    const betaPerson = await createPerson(repositoryDatabase, beta.id, {
      displayName: 'Beta person',
      type: 'member',
    });

    await expect(
      createFinancialAccount(repositoryDatabase, alpha.id, {
        institutionName: 'Example Bank',
        displayName: 'Cross-household account',
        accountType: 'savings',
        maskedReference: undefined,
        currency: 'INR',
        primaryPersonId: betaPerson.id,
        joint: false,
        additionalPersonIds: [],
      }),
    ).rejects.toThrow('A selected account holder does not belong to this household');
  });

  it('provisions one linked person per Clerk member idempotently', async () => {
    const household = await createHousehold(repositoryDatabase, {
      clerkOrganizationId: 'org_alpha',
      name: 'Alpha household',
      createdByClerkUserId: 'user_alpha',
    });

    const first = await ensureLinkedPerson(repositoryDatabase, household.id, {
      linkedClerkUserId: 'user_alpha',
      displayName: 'First name',
    });
    const second = await ensureLinkedPerson(repositoryDatabase, household.id, {
      linkedClerkUserId: 'user_alpha',
      displayName: 'Updated name',
    });

    expect(second.id).toBe(first.id);
    await expect(listPeople(repositoryDatabase, household.id)).resolves.toMatchObject([
      {displayName: 'Updated name', linkedClerkUserId: 'user_alpha'},
    ]);
  });

  it('persists joint account ownership for multiple people', async () => {
    const household = await createHousehold(repositoryDatabase, {
      clerkOrganizationId: 'org_joint',
      name: 'Joint household',
      createdByClerkUserId: 'user_primary',
    });
    const primary = await createPerson(repositoryDatabase, household.id, {
      displayName: 'Primary person',
      type: 'member',
    });
    const additional = await createPerson(repositoryDatabase, household.id, {
      displayName: 'Additional person',
      type: 'member',
    });

    const account = await createFinancialAccount(repositoryDatabase, household.id, {
      institutionName: 'Example Bank',
      displayName: 'Joint savings',
      accountType: 'savings',
      maskedReference: '•••• 1234',
      currency: 'INR',
      primaryPersonId: primary.id,
      joint: true,
      additionalPersonIds: [additional.id],
    });

    await expect(
      database.select().from(schema.financialAccountPeople),
    ).resolves.toMatchObject([
      {
        householdId: household.id,
        financialAccountId: account.id,
        personId: additional.id,
      },
    ]);
  });
});
