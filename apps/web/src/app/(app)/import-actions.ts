'use server';

import {
  commitImportSession,
  createImportSession,
  mapImportSession,
  rollbackImportSession,
  setImportCandidateDecision,
} from '@koshara/database';
import {csvColumnMappingSchema, importCandidateDecisionSchema} from '@koshara/domain';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';

import {requireHouseholdAccess} from '@/lib/auth';
import {getDatabase} from '@/lib/database';
import {CsvUploadValidationError, parseCsvUploadForm} from '@/lib/import-upload';

export type ImportActionResult = {
  status: 'success' | 'error';
  message: string;
  importSessionId?: string;
};

const sessionIdSchema = z.object({importSessionId: z.uuid()}).strict();
const mapSessionSchema = z.object({
  importSessionId: z.uuid(),
  mappings: z.array(z.object({fileId: z.uuid(), mapping: csvColumnMappingSchema}).strict()).min(1).max(5),
}).strict();
const candidateDecisionInputSchema = z.object({
  importSessionId: z.uuid(),
  importCandidateId: z.uuid(),
  decision: importCandidateDecisionSchema,
}).strict();

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Check the form and try again';
}

export async function createCsvImportSessionAction(formData: FormData): Promise<ImportActionResult> {
  let context: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    context = await requireHouseholdAccess();
  } catch {
    return {status: 'error', message: 'The import session could not be created'};
  }

  let upload;
  try {
    upload = await parseCsvUploadForm(formData);
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof CsvUploadValidationError ? error.message : 'The CSV files could not be read',
    };
  }

  try {
    const session = await createImportSession(getDatabase(), context.householdId, {
      ...upload,
      createdByClerkUserId: context.clerkUserId,
    });
    revalidatePath('/imports');
    return {status: 'success', message: 'CSV files uploaded. Map their columns next.', importSessionId: session.id};
  } catch {
    return {status: 'error', message: 'The import session could not be created'};
  }
}

export async function mapCsvImportSessionAction(rawInput: unknown): Promise<ImportActionResult> {
  const parsed = mapSessionSchema.safeParse(rawInput);
  if (!parsed.success) return {status: 'error', message: validationMessage(parsed.error)};

  try {
    const context = await requireHouseholdAccess();
    await mapImportSession(getDatabase(), context.householdId, parsed.data.importSessionId, parsed.data.mappings);
    revalidatePath('/imports');
    revalidatePath(`/imports/${parsed.data.importSessionId}`);
    return {status: 'success', message: 'Columns mapped. Review every candidate before committing.'};
  } catch {
    return {status: 'error', message: 'The CSV columns could not be mapped'};
  }
}

export async function setCsvImportDecisionAction(rawInput: unknown): Promise<ImportActionResult> {
  const parsed = candidateDecisionInputSchema.safeParse(rawInput);
  if (!parsed.success) return {status: 'error', message: validationMessage(parsed.error)};

  try {
    const context = await requireHouseholdAccess();
    await setImportCandidateDecision(
      getDatabase(),
      context.householdId,
      parsed.data.importSessionId,
      parsed.data.importCandidateId,
      parsed.data.decision,
    );
    revalidatePath(`/imports/${parsed.data.importSessionId}`);
    return {status: 'success', message: parsed.data.decision === 'include' ? 'Candidate will be imported' : 'Candidate will be skipped'};
  } catch {
    return {status: 'error', message: 'The candidate decision could not be saved'};
  }
}

export async function commitCsvImportSessionAction(rawInput: unknown): Promise<ImportActionResult> {
  const parsed = sessionIdSchema.safeParse(rawInput);
  if (!parsed.success) return {status: 'error', message: validationMessage(parsed.error)};

  try {
    const context = await requireHouseholdAccess();
    const count = await commitImportSession(getDatabase(), context.householdId, parsed.data.importSessionId);
    revalidatePath('/imports');
    revalidatePath(`/imports/${parsed.data.importSessionId}`);
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return {status: 'success', message: `${count} transaction${count === 1 ? '' : 's'} committed`};
  } catch {
    revalidatePath(`/imports/${parsed.data.importSessionId}`);
    return {status: 'error', message: 'Resolve duplicate decisions before committing this import'};
  }
}

export async function rollbackCsvImportSessionAction(rawInput: unknown): Promise<ImportActionResult> {
  const parsed = sessionIdSchema.safeParse(rawInput);
  if (!parsed.success) return {status: 'error', message: validationMessage(parsed.error)};

  try {
    const context = await requireHouseholdAccess();
    const count = await rollbackImportSession(getDatabase(), context.householdId, parsed.data.importSessionId);
    revalidatePath('/imports');
    revalidatePath(`/imports/${parsed.data.importSessionId}`);
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return {status: 'success', message: `${count} transaction${count === 1 ? '' : 's'} rolled back`};
  } catch {
    return {status: 'error', message: 'The committed import could not be rolled back'};
  }
}
