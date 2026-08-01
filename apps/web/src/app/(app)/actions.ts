'use server';

import {clerkClient} from '@clerk/nextjs/server';
import {createFinancialAccount, createPerson} from '@koshara/database';
import {
  createFinancialAccountSchema,
  createPersonSchema,
  isEmailAllowed,
} from '@koshara/domain';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';

import {requireHouseholdAccess} from '@/lib/auth';
import {getDatabase} from '@/lib/database';
import {getServerEnvironment} from '@/lib/environment';

export type ActionResult = {status: 'success' | 'error'; message: string};

function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the form and try again';
}

export async function createPersonAction(rawInput: unknown): Promise<ActionResult> {
  const parsed = createPersonSchema.safeParse(rawInput);
  if (!parsed.success) return {status: 'error', message: validationMessage(parsed.error)};

  try {
    const context = await requireHouseholdAccess();
    await createPerson(getDatabase(), context.householdId, parsed.data);
    revalidatePath('/accounts');
    return {status: 'success', message: 'Household person added'};
  } catch {
    return {status: 'error', message: 'The person could not be added'};
  }
}

export async function createAccountAction(rawInput: unknown): Promise<ActionResult> {
  const parsed = createFinancialAccountSchema.safeParse(rawInput);
  if (!parsed.success) return {status: 'error', message: validationMessage(parsed.error)};

  try {
    const context = await requireHouseholdAccess();
    await createFinancialAccount(getDatabase(), context.householdId, parsed.data);
    revalidatePath('/accounts');
    return {status: 'success', message: 'Financial account added'};
  } catch {
    return {status: 'error', message: 'The account could not be added'};
  }
}

const inviteSchema = z.object({emailAddress: z.email().trim().toLowerCase()});

export async function inviteHouseholdMemberAction(rawInput: unknown): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(rawInput);
  if (!parsed.success) return {status: 'error', message: validationMessage(parsed.error)};

  try {
    const context = await requireHouseholdAccess('owner');
    if (!isEmailAllowed([parsed.data.emailAddress], getServerEnvironment().allowedEmails)) {
      return {status: 'error', message: 'This address is not in ALLOWED_USER_EMAILS'};
    }

    const client = await clerkClient();
    await client.organizations.createOrganizationInvitation({
      organizationId: context.clerkOrganizationId,
      inviterUserId: context.clerkUserId,
      emailAddress: parsed.data.emailAddress,
      role: 'org:member',
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard`,
    });

    return {status: 'success', message: 'Invitation sent'};
  } catch {
    return {status: 'error', message: 'The invitation could not be sent'};
  }
}
