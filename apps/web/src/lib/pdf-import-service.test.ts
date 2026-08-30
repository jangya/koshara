import {describe, expect, it, vi} from 'vitest';

import type {KosharaDatabase} from '@koshara/database';

import {PdfImportWorkflowError, runPdfImportWorkflow} from './pdf-import-service';
import type {ParsedPdfUpload} from './pdf-import';
import type {PrivateDocumentStorage} from './private-document-storage';

const householdId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const accountId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const upload: ParsedPdfUpload = {
  financialAccountId: accountId,
  password: 'transient password',
  file: {
    originalFilename: 'synthetic.pdf',
    contentType: 'application/pdf',
    byteSize: 12,
    checksumSha256: 'c'.repeat(64),
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4, 5, 6, 7]),
  },
};
const extraction = {
  pageCount: 1,
  extractedTextBytes: 64,
  parsedCsv: {
    headers: ['Column 1'],
    rows: [{rowNumber: 2, values: {'Column 1': 'Synthetic statement row'}}],
  },
};

function dependencies(overrides: {
  put?: PrivateDocumentStorage['put'];
  remove?: PrivateDocumentStorage['remove'];
  stage?: Parameters<typeof runPdfImportWorkflow>[0]['stageImportSession'];
} = {}) {
  const storage: PrivateDocumentStorage = {
    put: overrides.put ?? vi.fn(async () => undefined),
    get: vi.fn(async () => new Uint8Array()),
    remove: overrides.remove ?? vi.fn(async () => undefined),
  };
  const stageImportSession = overrides.stage ?? vi.fn(async () => ({id: 'session_1'}));
  return {storage, stageImportSession};
}

describe('runPdfImportWorkflow', () => {
  it('uploads privately and stages extracted rows without forwarding the password', async () => {
    const deps = dependencies();
    const result = await runPdfImportWorkflow({
      database: {} as KosharaDatabase,
      householdId,
      clerkUserId: 'user_1',
      upload,
      storage: deps.storage,
      gmailAttachmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      extractStatement: vi.fn(async () => extraction),
      stageImportSession: deps.stageImportSession,
    });

    expect(result).toEqual({importSessionId: 'session_1'});
    expect(deps.storage.put).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'application/pdf',
      checksumSha256: 'c'.repeat(64),
      key: expect.stringMatching(/^households\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/statements\/[0-9a-f-]{36}\.pdf$/u),
    }));
    const stagedInput = vi.mocked(deps.stageImportSession).mock.calls[0]![2];
    expect(JSON.stringify(stagedInput)).not.toContain('transient password');
    expect(stagedInput.files[0]).toMatchObject({
      sourceType: 'pdf',
      parsedCsv: extraction.parsedCsv,
      document: {gmailAttachmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'},
    });
  });

  it('does not create database metadata when object storage fails', async () => {
    const deps = dependencies({put: vi.fn(async () => { throw new Error('R2 unavailable'); })});

    await expect(runPdfImportWorkflow({
      database: {} as KosharaDatabase,
      householdId,
      clerkUserId: 'user_1',
      upload,
      storage: deps.storage,
      extractStatement: vi.fn(async () => extraction),
      stageImportSession: deps.stageImportSession,
    })).rejects.toMatchObject({code: 'DOCUMENT_STORAGE_FAILED'});
    expect(deps.stageImportSession).not.toHaveBeenCalled();
    expect(deps.storage.remove).toHaveBeenCalledOnce();
  });

  it('reports ambiguous upload cleanup failure without exposing storage details', async () => {
    const deps = dependencies({
      put: vi.fn(async () => { throw new Error('secret upload detail'); }),
      remove: vi.fn(async () => { throw new Error('secret cleanup detail'); }),
    });

    await expect(runPdfImportWorkflow({
      database: {} as KosharaDatabase,
      householdId,
      clerkUserId: 'user_1',
      upload,
      storage: deps.storage,
      extractStatement: vi.fn(async () => extraction),
      stageImportSession: deps.stageImportSession,
    })).rejects.toEqual(new PdfImportWorkflowError(
      'DOCUMENT_CLEANUP_FAILED',
      'The statement upload was not confirmed and its private object requires cleanup',
    ));
    expect(deps.stageImportSession).not.toHaveBeenCalled();
  });

  it('removes the private object when database staging fails', async () => {
    const deps = dependencies({stage: vi.fn(async () => { throw new Error('Database unavailable'); })});

    await expect(runPdfImportWorkflow({
      database: {} as KosharaDatabase,
      householdId,
      clerkUserId: 'user_1',
      upload,
      storage: deps.storage,
      extractStatement: vi.fn(async () => extraction),
      stageImportSession: deps.stageImportSession,
    })).rejects.toMatchObject({code: 'DOCUMENT_METADATA_FAILED'});
    expect(deps.storage.remove).toHaveBeenCalledOnce();
  });

  it('reports cleanup failure without exposing a password or storage error', async () => {
    const deps = dependencies({
      stage: vi.fn(async () => { throw new Error('Database unavailable'); }),
      remove: vi.fn(async () => { throw new Error('secret R2 endpoint detail'); }),
    });

    const operation = runPdfImportWorkflow({
      database: {} as KosharaDatabase,
      householdId,
      clerkUserId: 'user_1',
      upload,
      storage: deps.storage,
      extractStatement: vi.fn(async () => extraction),
      stageImportSession: deps.stageImportSession,
    });
    await expect(operation).rejects.toEqual(new PdfImportWorkflowError(
      'DOCUMENT_CLEANUP_FAILED',
      'The statement could not be staged and its private object requires cleanup',
    ));
    await expect(operation).rejects.not.toThrow('transient password');
    await expect(operation).rejects.not.toThrow('secret R2 endpoint detail');
  });
});
