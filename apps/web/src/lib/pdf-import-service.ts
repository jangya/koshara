import {randomUUID} from 'node:crypto';

import {createImportSession, type KosharaDatabase} from '@koshara/database';

import {extractPdfStatement, type ParsedPdfUpload} from './pdf-import';
import type {PrivateDocumentStorage} from './private-document-storage';

export type PdfImportWorkflowErrorCode =
  | 'DOCUMENT_STORAGE_FAILED'
  | 'DOCUMENT_METADATA_FAILED'
  | 'DOCUMENT_CLEANUP_FAILED';

export class PdfImportWorkflowError extends Error {
  readonly code: PdfImportWorkflowErrorCode;

  constructor(code: PdfImportWorkflowErrorCode, message: string) {
    super(message);
    this.name = 'PdfImportWorkflowError';
    this.code = code;
  }
}

type StageImportSession = (
  database: KosharaDatabase,
  householdId: string,
  input: Parameters<typeof createImportSession>[2],
) => Promise<{id: string}>;

export async function runPdfImportWorkflow(input: {
  database: KosharaDatabase;
  householdId: string;
  clerkUserId: string;
  upload: ParsedPdfUpload;
  storage: PrivateDocumentStorage;
  gmailAttachmentId?: string;
  extractStatement?: typeof extractPdfStatement;
  stageImportSession?: StageImportSession;
}) {
  const extractStatement = input.extractStatement ?? extractPdfStatement;
  const stageImportSession = input.stageImportSession ?? createImportSession;
  const extracted = await extractStatement(input.upload.file.bytes, {password: input.upload.password});
  const objectKey = `households/${input.householdId}/statements/${randomUUID()}.pdf`;

  try {
    await input.storage.put({
      key: objectKey,
      bytes: input.upload.file.bytes,
      contentType: input.upload.file.contentType,
      checksumSha256: input.upload.file.checksumSha256,
    });
  } catch {
    try {
      await input.storage.remove(objectKey);
    } catch {
      throw new PdfImportWorkflowError(
        'DOCUMENT_CLEANUP_FAILED',
        'The statement upload was not confirmed and its private object requires cleanup',
      );
    }
    throw new PdfImportWorkflowError('DOCUMENT_STORAGE_FAILED', 'The statement could not be stored privately');
  }

  try {
    const session = await stageImportSession(input.database, input.householdId, {
      financialAccountId: input.upload.financialAccountId,
      createdByClerkUserId: input.clerkUserId,
      files: [{
        sourceType: 'pdf',
        originalFilename: input.upload.file.originalFilename,
        parsedCsv: extracted.parsedCsv,
        document: {
          objectKey,
          contentType: input.upload.file.contentType,
          byteSize: input.upload.file.byteSize,
          checksumSha256: input.upload.file.checksumSha256,
          pageCount: extracted.pageCount,
          extractedTextBytes: extracted.extractedTextBytes,
          gmailAttachmentId: input.gmailAttachmentId,
        },
      }],
    });
    return {importSessionId: session.id};
  } catch {
    try {
      await input.storage.remove(objectKey);
    } catch {
      throw new PdfImportWorkflowError(
        'DOCUMENT_CLEANUP_FAILED',
        'The statement could not be staged and its private object requires cleanup',
      );
    }
    throw new PdfImportWorkflowError('DOCUMENT_METADATA_FAILED', 'The statement metadata could not be staged');
  }
}
