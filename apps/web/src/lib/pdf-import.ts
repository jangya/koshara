import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {Worker} from 'node:worker_threads';

import {z} from 'zod';

import type {ParsedCsv} from '@koshara/domain';

export type PdfImportLimits = {
  maxBytes: number;
  maxPages: number;
  maxRows: number;
  maxColumns: number;
  maxFieldLength: number;
  maxExtractedTextBytes: number;
  timeoutMs: number;
};

export const pdfImportLimits: PdfImportLimits = {
  maxBytes: 10 * 1024 * 1024,
  maxPages: 100,
  maxRows: 5_000,
  maxColumns: 100,
  maxFieldLength: 2_000,
  maxExtractedTextBytes: 2 * 1024 * 1024,
  timeoutMs: 15_000,
} as const;
export type PdfImportErrorCode =
  | 'INVALID_PDF_UPLOAD'
  | 'MALFORMED_PDF'
  | 'PDF_PASSWORD_REQUIRED'
  | 'PDF_PASSWORD_INVALID'
  | 'PDF_LIMIT_EXCEEDED'
  | 'PDF_EXTRACTION_TIMEOUT';

export class PdfImportError extends Error {
  readonly code: PdfImportErrorCode;

  constructor(code: PdfImportErrorCode, message: string) {
    super(message);
    this.name = 'PdfImportError';
    this.code = code;
  }
}

export type ParsedPdfUpload = {
  financialAccountId: string;
  password?: string;
  file: {
    originalFilename: string;
    contentType: 'application/pdf';
    byteSize: number;
    checksumSha256: string;
    bytes: Uint8Array;
  };
};

function uploadError(message: string): never {
  throw new PdfImportError('INVALID_PDF_UPLOAD', message);
}

export async function parsePdfUploadForm(formData: FormData): Promise<ParsedPdfUpload> {
  const financialAccountId = z.uuid().safeParse(formData.get('financialAccountId'));
  if (!financialAccountId.success) uploadError('Choose a valid financial account');

  const entry = formData.get('file');
  if (!(entry instanceof File)) uploadError('Choose one PDF file');
  if (entry.size === 0) uploadError(`${entry.name || 'The PDF file'} cannot be empty`);
  if (entry.size > pdfImportLimits.maxBytes) uploadError(`${entry.name || 'The PDF file'} exceeds the 10 MB limit`);
  if (
    entry.name.length === 0
    || entry.name.length > 255
    || !entry.name.toLocaleLowerCase('en-US').endsWith('.pdf')
    || /[/\\\u0000-\u001f\u007f]/u.test(entry.name)
  ) uploadError('The PDF filename is invalid');
  if (entry.type.toLocaleLowerCase('en-US') !== 'application/pdf') uploadError('Only PDF files are accepted');

  const passwordEntry = formData.get('password');
  if (passwordEntry !== null && typeof passwordEntry !== 'string') uploadError('The PDF password is invalid');
  if (typeof passwordEntry === 'string' && passwordEntry.length > 256) {
    uploadError('The PDF password must be no more than 256 characters');
  }

  const fileBytes = new Uint8Array(await entry.arrayBuffer());
  if (
    fileBytes.length < 5
    || fileBytes[0] !== 0x25
    || fileBytes[1] !== 0x50
    || fileBytes[2] !== 0x44
    || fileBytes[3] !== 0x46
    || fileBytes[4] !== 0x2d
  ) uploadError('The file does not have a valid PDF header');

  return {
    financialAccountId: financialAccountId.data,
    password: passwordEntry || undefined,
    file: {
      originalFilename: entry.name,
      contentType: 'application/pdf',
      byteSize: fileBytes.length,
      checksumSha256: createHash('sha256').update(fileBytes).digest('hex'),
      bytes: fileBytes,
    },
  };
}

const workerResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    value: z.object({
      pageCount: z.number().int().positive(),
      extractedTextBytes: z.number().int().positive(),
      parsedCsv: z.object({
        headers: z.array(z.string()),
        rows: z.array(z.object({
          rowNumber: z.number().int(),
          values: z.record(z.string(), z.string()),
        })),
      }),
    }),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum([
      'MALFORMED_PDF',
      'PDF_PASSWORD_REQUIRED',
      'PDF_PASSWORD_INVALID',
      'PDF_LIMIT_EXCEEDED',
    ]),
    message: z.string(),
  }),
]);

export async function extractPdfStatement(
  input: Uint8Array,
  options: {password?: string; limits?: PdfImportLimits} = {},
): Promise<{parsedCsv: ParsedCsv; pageCount: number; extractedTextBytes: number}> {
  const limits = options.limits ?? pdfImportLimits;
  const worker = new Worker(join(process.cwd(), 'src/lib/pdf-extraction-worker.mjs'), {
    name: 'koshara-pdf-extraction',
    workerData: {data: Uint8Array.from(input), password: options.password, limits},
    env: {},
    execArgv: [],
    stdout: true,
    stderr: true,
    resourceLimits: {
      maxOldGenerationSizeMb: 128,
      maxYoungGenerationSizeMb: 32,
      codeRangeSizeMb: 32,
      stackSizeMb: 4,
    },
  });
  worker.stdout.resume();
  worker.stderr.resume();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new PdfImportError('PDF_EXTRACTION_TIMEOUT', 'PDF extraction exceeded the processing time limit'));
      void worker.terminate();
    }, limits.timeoutMs);

    function finish(callback: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
      void worker.terminate();
    }

    worker.once('message', (message: unknown) => finish(() => {
      const parsed = workerResponseSchema.safeParse(message);
      if (!parsed.success) {
        reject(new PdfImportError('MALFORMED_PDF', 'The PDF parser returned invalid output'));
        return;
      }
      if (!parsed.data.ok) {
        reject(new PdfImportError(parsed.data.code, parsed.data.message));
        return;
      }
      const value = parsed.data.value;
      if (
        value.pageCount > limits.maxPages
        || value.extractedTextBytes > limits.maxExtractedTextBytes
        || value.parsedCsv.headers.length > limits.maxColumns
        || value.parsedCsv.rows.length > limits.maxRows
      ) {
        reject(new PdfImportError('PDF_LIMIT_EXCEEDED', 'The PDF parser returned output outside configured limits'));
        return;
      }
      resolve(value);
    }));
    worker.once('error', () => finish(() => {
      reject(new PdfImportError('PDF_LIMIT_EXCEEDED', 'The PDF extraction worker exceeded its resource limit'));
    }));
    worker.once('exit', (code) => {
      if (code !== 0) finish(() => {
        reject(new PdfImportError('MALFORMED_PDF', 'The PDF extraction worker stopped unexpectedly'));
      });
    });
  });
}
