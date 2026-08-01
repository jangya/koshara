import type {CreateFinancialAccountInput, CreatePersonInput} from '@koshara/domain';
import {and, asc, eq, inArray, sql} from 'drizzle-orm';

import type {KosharaDatabase} from './client';
import {financialAccountPeople, financialAccounts, households, people} from './schema';

export async function createHousehold(
  database: KosharaDatabase,
  input: {clerkOrganizationId: string; name: string; createdByClerkUserId: string},
) {
  const [household] = await database
    .insert(households)
    .values(input)
    .onConflictDoUpdate({
      target: households.clerkOrganizationId,
      set: {name: input.name, updatedAt: new Date()},
    })
    .returning();

  if (!household) {
    throw new Error('Household could not be created');
  }

  return household;
}

export async function findHouseholdByClerkOrganizationId(
  database: KosharaDatabase,
  clerkOrganizationId: string,
) {
  return database.query.households.findFirst({
    where: eq(households.clerkOrganizationId, clerkOrganizationId),
  });
}

export async function createPerson(database: KosharaDatabase, householdId: string, input: CreatePersonInput) {
  const [person] = await database.insert(people).values({...input, householdId}).returning();

  if (!person) {
    throw new Error('Person could not be created');
  }

  return person;
}

export async function ensureLinkedPerson(
  database: KosharaDatabase,
  householdId: string,
  input: {linkedClerkUserId: string; displayName: string},
) {
  const [person] = await database
    .insert(people)
    .values({...input, householdId, type: 'member'})
    .onConflictDoUpdate({
      target: [people.householdId, people.linkedClerkUserId],
      targetWhere: sql`${people.linkedClerkUserId} is not null`,
      set: {displayName: input.displayName, active: true, updatedAt: new Date()},
    })
    .returning();

  if (!person) {
    throw new Error('Linked household person could not be provisioned');
  }

  return person;
}

export async function listPeople(database: KosharaDatabase, householdId: string) {
  return database
    .select()
    .from(people)
    .where(eq(people.householdId, householdId))
    .orderBy(asc(people.displayName));
}

export async function createFinancialAccount(
  database: KosharaDatabase,
  householdId: string,
  input: CreateFinancialAccountInput,
) {
  const requestedPersonIds = [...new Set([input.primaryPersonId, ...input.additionalPersonIds])];
  const householdPeople = await database
    .select({id: people.id})
    .from(people)
    .where(and(eq(people.householdId, householdId), inArray(people.id, requestedPersonIds)));

  if (householdPeople.length !== requestedPersonIds.length) {
    throw new Error('A selected account holder does not belong to this household');
  }

  return database.transaction(async (transaction) => {
    const [account] = await transaction
      .insert(financialAccounts)
      .values({
        householdId,
        institutionName: input.institutionName,
        displayName: input.displayName,
        accountType: input.accountType,
        maskedReference: input.maskedReference,
        currency: input.currency,
        primaryPersonId: input.primaryPersonId,
        joint: input.joint,
      })
      .returning();

    if (!account) {
      throw new Error('Financial account could not be created');
    }

    if (input.additionalPersonIds.length > 0) {
      await transaction.insert(financialAccountPeople).values(
        input.additionalPersonIds.map((personId) => ({
          householdId,
          financialAccountId: account.id,
          personId,
        })),
      );
    }

    return account;
  });
}

export async function listFinancialAccounts(database: KosharaDatabase, householdId: string) {
  return database
    .select()
    .from(financialAccounts)
    .where(eq(financialAccounts.householdId, householdId))
    .orderBy(asc(financialAccounts.displayName));
}
