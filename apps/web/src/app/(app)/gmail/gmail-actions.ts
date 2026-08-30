'use server';

import {
  beginGmailDiscovery,
  claimGmailAttachmentForImport,
  disconnectGmailConnection,
  getGmailConnection,
  releaseGmailAttachmentImport,
  updateGmailConnectionAccessToken,
  upsertGmailAttachments,
} from '@koshara/database';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';

import {requireHouseholdAccess} from '@/lib/auth';
import {
  discoverGmailPdfAttachments,
  downloadGmailPdfAttachment,
  revokeGoogleToken,
} from '@/lib/gmail-api';
import {getUsableGmailAccessToken} from '@/lib/gmail-connection-service';
import {getDatabase} from '@/lib/database';
import {getGmailEnvironment} from '@/lib/environment';
import {decryptGmailToken} from '@/lib/gmail-token-crypto';
import {parsePdfUploadForm, PdfImportError} from '@/lib/pdf-import';
import {runPdfImportWorkflow, PdfImportWorkflowError} from '@/lib/pdf-import-service';
import {getPrivateDocumentStorage} from '@/lib/private-document-storage';

export type GmailActionResult = {
  status: 'success' | 'warning' | 'error';
  message: string;
  importSessionId?: string;
};

const connectionInputSchema = z.object({connectionId: z.uuid()}).strict();
const gmailImportSchema = z.object({
  gmailAttachmentId: z.uuid(),
  financialAccountId: z.uuid(),
  password: z.string().max(256).optional(),
}).strict();

async function activeConnectionAccess(context: Awaited<ReturnType<typeof requireHouseholdAccess>>) {
  const connection = await getGmailConnection(getDatabase(), context.householdId, context.clerkUserId);
  if (!connection || connection.disconnectedAt) throw new Error('Gmail is not connected');
  const environment = getGmailEnvironment();
  const accessToken = await getUsableGmailAccessToken({
    householdId: context.householdId,
    connection,
    encryptionKey: environment.tokenEncryptionKey,
    environment,
    updateAccessToken: (value) => updateGmailConnectionAccessToken(
      getDatabase(),
      context.householdId,
      context.clerkUserId,
      connection.id,
      value,
    ),
  });
  return {connection, accessToken};
}

export async function discoverGmailStatementsAction(): Promise<GmailActionResult> {
  try {
    const context = await requireHouseholdAccess();
    const {connection, accessToken} = await activeConnectionAccess(context);
    await beginGmailDiscovery(getDatabase(), context.householdId, context.clerkUserId, connection.id);
    const attachments = await discoverGmailPdfAttachments({accessToken});
    const inserted = await upsertGmailAttachments(
      getDatabase(),
      context.householdId,
      context.clerkUserId,
      connection.id,
      attachments,
    );
    revalidatePath('/gmail');
    return {
      status: 'success',
      message: inserted.length === 0
        ? 'Discovery finished. No new PDF statements were found in the bounded mailbox search.'
        : `${inserted.length} new PDF statement${inserted.length === 1 ? '' : 's'} discovered`,
    };
  } catch {
    return {status: 'error', message: 'Gmail discovery could not be completed safely. Reconnect Gmail if the problem continues.'};
  }
}

export async function disconnectGmailAction(rawInput: unknown): Promise<GmailActionResult> {
  const parsed = connectionInputSchema.safeParse(rawInput);
  if (!parsed.success) return {status: 'error', message: 'The Gmail connection could not be disconnected'};
  try {
    const context = await requireHouseholdAccess();
    const connection = await getGmailConnection(getDatabase(), context.householdId, context.clerkUserId);
    if (!connection || connection.id !== parsed.data.connectionId) {
      return {status: 'error', message: 'The Gmail connection could not be disconnected'};
    }
    let revocationConfirmed = false;
    if (connection.encryptedRefreshToken && !connection.disconnectedAt) {
      try {
        const environment = getGmailEnvironment();
        const refreshToken = decryptGmailToken(connection.encryptedRefreshToken, environment.tokenEncryptionKey, {
          householdId: context.householdId,
          connectionId: connection.id,
          tokenKind: 'refresh',
        });
        revocationConfirmed = await revokeGoogleToken(refreshToken);
      } catch {
        // Local credential removal must still succeed if decryption or provider revocation fails.
      }
    }
    await disconnectGmailConnection(
      getDatabase(),
      context.householdId,
      context.clerkUserId,
      connection.id,
    );
    revalidatePath('/gmail');
    return revocationConfirmed
      ? {status: 'success', message: 'Gmail access was revoked and local encrypted credentials were removed'}
      : {
          status: 'warning',
          message: 'Local credentials were removed, but Google revocation was not confirmed. Remove Koshara in Google Account access settings.',
        };
  } catch {
    return {status: 'error', message: 'The Gmail connection could not be disconnected'};
  }
}

export async function importGmailAttachmentAction(formData: FormData): Promise<GmailActionResult> {
  let context: Awaited<ReturnType<typeof requireHouseholdAccess>>;
  try {
    context = await requireHouseholdAccess();
  } catch {
    return {status: 'error', message: 'The Gmail statement could not be imported'};
  }
  const rawPassword = formData.get('password');
  const parsed = gmailImportSchema.safeParse({
    gmailAttachmentId: formData.get('gmailAttachmentId'),
    financialAccountId: formData.get('financialAccountId'),
    password: typeof rawPassword === 'string' && rawPassword.length > 0 ? rawPassword : undefined,
  });
  if (!parsed.success) return {status: 'error', message: 'Choose a valid statement and financial account'};

  let claimed = false;
  try {
    const attachment = await claimGmailAttachmentForImport(
      getDatabase(),
      context.householdId,
      context.clerkUserId,
      parsed.data.gmailAttachmentId,
    );
    claimed = true;
    const {connection, accessToken} = await activeConnectionAccess(context);
    if (connection.id !== attachment.gmailConnectionId) throw new Error('The Gmail connection does not match the attachment');
    const bytes = await downloadGmailPdfAttachment({
      accessToken,
      gmailMessageId: attachment.gmailMessageId,
      gmailAttachmentId: attachment.gmailAttachmentId,
      gmailPartId: attachment.gmailPartId,
      expectedSize: attachment.byteSize,
    });
    const pdfFormData = new FormData();
    pdfFormData.set('financialAccountId', parsed.data.financialAccountId);
    pdfFormData.set('file', new File([bytes], attachment.originalFilename, {type: 'application/pdf'}));
    if (parsed.data.password) pdfFormData.set('password', parsed.data.password);
    const upload = await parsePdfUploadForm(pdfFormData);
    const result = await runPdfImportWorkflow({
      database: getDatabase(),
      householdId: context.householdId,
      clerkUserId: context.clerkUserId,
      upload,
      storage: getPrivateDocumentStorage(),
      gmailAttachmentId: attachment.id,
    });
    claimed = false;
    revalidatePath('/gmail');
    revalidatePath('/imports');
    return {
      status: 'success',
      message: 'Gmail PDF stored privately and extracted. Map its fields next.',
      importSessionId: result.importSessionId,
    };
  } catch (error) {
    if (claimed) {
      try {
        await releaseGmailAttachmentImport(
          getDatabase(),
          context.householdId,
          context.clerkUserId,
          parsed.data.gmailAttachmentId,
        );
      } catch {
        return {status: 'error', message: 'The Gmail statement import could not be reset and requires operator review'};
      }
    }
    if (error instanceof PdfImportError || error instanceof PdfImportWorkflowError) {
      return {status: 'error', message: error.message};
    }
    return {status: 'error', message: 'The Gmail statement could not be imported safely'};
  }
}
