import {createHash} from 'node:crypto';

import {describe, expect, it} from 'vitest';

import {
  PdfImportError,
  extractPdfStatement,
  parsePdfUploadForm,
  pdfImportLimits,
} from './pdf-import';

const accountId = '11111111-1111-4111-8111-111111111111';
const passwordPadding = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function concat(...values: Uint8Array[]) {
  const result = new Uint8Array(values.reduce((total, value) => total + value.length, 0));
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}

function rc4(key: Uint8Array, input: Uint8Array) {
  const state = Uint8Array.from({length: 256}, (_, index) => index);
  let cursor = 0;
  for (let index = 0; index < state.length; index += 1) {
    cursor = (cursor + state[index]! + key[index % key.length]!) & 0xff;
    [state[index], state[cursor]] = [state[cursor]!, state[index]!];
  }
  const output = new Uint8Array(input.length);
  let left = 0;
  cursor = 0;
  for (let index = 0; index < input.length; index += 1) {
    left = (left + 1) & 0xff;
    cursor = (cursor + state[left]!) & 0xff;
    [state[left], state[cursor]] = [state[cursor]!, state[left]!];
    output[index] = input[index]! ^ state[(state[left]! + state[cursor]!) & 0xff]!;
  }
  return output;
}

function md5(input: Uint8Array) {
  return new Uint8Array(createHash('md5').update(input).digest());
}

function paddedPassword(password: string) {
  return concat(bytes(password).slice(0, 32), passwordPadding).slice(0, 32);
}

function objectKey(documentKey: Uint8Array, objectNumber: number) {
  return md5(concat(
    documentKey,
    Uint8Array.of(objectNumber & 0xff, (objectNumber >> 8) & 0xff, (objectNumber >> 16) & 0xff, 0, 0),
  )).slice(0, Math.min(documentKey.length + 5, 16));
}

function pdfObject(number: number, body: Uint8Array | string) {
  return concat(bytes(`${number} 0 obj\n`), typeof body === 'string' ? bytes(body) : body, bytes('\nendobj\n'));
}

function buildPdf(options: {password?: string; rows?: string[][]} = {}) {
  const rows = options.rows ?? [
    ['Date', 'Description', 'Amount'],
    ['01/02/2026', 'Synthetic coffee', '-10.50'],
    ['02/02/2026', 'Synthetic refund', '25.00'],
  ];
  const content = rows.flatMap((row, rowIndex) => row.map((value, columnIndex) =>
    `1 0 0 1 ${72 + columnIndex * 160} ${750 - rowIndex * 22} Tm (${value.replaceAll(/[()\\]/gu, '\\$&')}) Tj`,
  )).join('\n');
  let stream = bytes(`BT\n/F1 10 Tf\n${content}\nET`);
  let encryptionDictionary: Uint8Array | undefined;

  if (options.password) {
    const ownerKey = rc4(md5(paddedPassword(options.password)).slice(0, 5), paddedPassword(options.password));
    const permissions = Uint8Array.of(0xfc, 0xff, 0xff, 0xff);
    const fileId = md5(bytes('Koshara synthetic PDF fixture'));
    const documentKey = md5(concat(paddedPassword(options.password), ownerKey, permissions, fileId)).slice(0, 5);
    const userKey = rc4(documentKey, passwordPadding);
    stream = rc4(objectKey(documentKey, 4), stream);
    encryptionDictionary = bytes(
      `6 0 obj\n<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${Buffer.from(ownerKey).toString('hex')}> /U <${Buffer.from(userKey).toString('hex')}> /P -4 >>\nendobj\n`,
    );
  }

  const objects = [
    pdfObject(1, '<< /Type /Catalog /Pages 2 0 R >>'),
    pdfObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    pdfObject(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>'),
    pdfObject(4, concat(bytes(`<< /Length ${stream.length} >>\nstream\n`), stream, bytes('\nendstream'))),
    pdfObject(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    ...(encryptionDictionary ? [encryptionDictionary] : []),
  ];
  const header = bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const offsets: number[] = [0];
  let offset = header.length;
  for (const object of objects) {
    offsets.push(offset);
    offset += object.length;
  }
  const xrefOffset = offset;
  const xref = bytes([
    `xref\n0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, '0')} 00000 n `),
  ].join('\n') + '\n');
  const fileId = createHash('md5').update('Koshara synthetic PDF fixture').digest('hex');
  const trailer = bytes(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${options.password ? ' /Encrypt 6 0 R' : ''} /ID [<${fileId}><${fileId}>] >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );
  return concat(header, ...objects, xref, trailer);
}

function uploadForm(file: File, password?: string) {
  const form = new FormData();
  form.set('financialAccountId', accountId);
  form.set('file', file);
  if (password !== undefined) form.set('password', password);
  return form;
}

describe('parsePdfUploadForm', () => {
  it('accepts one bounded PDF after checking its filename, MIME type, and magic bytes', async () => {
    const pdf = buildPdf();
    const upload = await parsePdfUploadForm(uploadForm(new File([pdf], 'statement.PDF', {type: 'application/pdf'})));

    expect(upload).toMatchObject({
      financialAccountId: accountId,
      file: {originalFilename: 'statement.PDF', contentType: 'application/pdf', byteSize: pdf.length},
    });
    expect(upload.file.checksumSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('rejects empty, oversized, wrongly named, wrongly typed, and fake PDF files', async () => {
    const validPdf = buildPdf();
    await expect(parsePdfUploadForm(uploadForm(new File([], 'empty.pdf', {type: 'application/pdf'}))))
      .rejects.toThrow('cannot be empty');
    await expect(parsePdfUploadForm(uploadForm(new File([new Uint8Array(pdfImportLimits.maxBytes + 1)], 'large.pdf', {type: 'application/pdf'}))))
      .rejects.toThrow('10 MB');
    await expect(parsePdfUploadForm(uploadForm(new File([validPdf], '../statement.pdf', {type: 'application/pdf'}))))
      .rejects.toThrow('filename');
    await expect(parsePdfUploadForm(uploadForm(new File([validPdf], 'statement.pdf', {type: 'text/plain'}))))
      .rejects.toThrow('PDF files');
    await expect(parsePdfUploadForm(uploadForm(new File(['not a pdf'], 'statement.pdf', {type: 'application/pdf'}))))
      .rejects.toThrow('valid PDF header');
  });

  it('bounds a supplied password without including it in validation errors', async () => {
    const secret = 'private statement password';
    const upload = await parsePdfUploadForm(uploadForm(
      new File([buildPdf()], 'statement.pdf', {type: 'application/pdf'}),
      secret,
    ));
    expect(upload.password).toBe(secret);

    const invalid = parsePdfUploadForm(uploadForm(
      new File([buildPdf()], 'statement.pdf', {type: 'application/pdf'}),
      'x'.repeat(257),
    ));
    await expect(invalid).rejects.toThrow('256 characters');
    await expect(invalid).rejects.not.toThrow('xxxxxxxx');
  });
});

describe('extractPdfStatement', () => {
  it('extracts positional statement rows into the existing ParsedCsv shape', async () => {
    const extracted = await extractPdfStatement(buildPdf());

    expect(extracted).toMatchObject({
      pageCount: 1,
      parsedCsv: {
        headers: ['Column 1', 'Column 2', 'Column 3'],
        rows: [
          {rowNumber: 2, values: {'Column 1': 'Date', 'Column 2': 'Description', 'Column 3': 'Amount'}},
          {rowNumber: 3, values: {'Column 1': '01/02/2026', 'Column 2': 'Synthetic coffee', 'Column 3': '-10.50'}},
          {rowNumber: 4, values: {'Column 1': '02/02/2026', 'Column 2': 'Synthetic refund', 'Column 3': '25.00'}},
        ],
      },
    });
  });

  it('fails closed for malformed documents and bounded extracted content', async () => {
    await expect(extractPdfStatement(bytes('%PDF-1.4\nmalformed\n%%EOF'))).rejects.toMatchObject({
      code: 'MALFORMED_PDF',
    });
    await expect(extractPdfStatement(buildPdf({rows: [['A', 'B', 'C']]}), {
      limits: {...pdfImportLimits, maxColumns: 2},
    })).rejects.toMatchObject({code: 'PDF_LIMIT_EXCEEDED'});
  });

  it('terminates extraction when the configured processing deadline expires', async () => {
    await expect(extractPdfStatement(buildPdf(), {
      limits: {...pdfImportLimits, timeoutMs: 1},
    })).rejects.toMatchObject({code: 'PDF_EXTRACTION_TIMEOUT'});
  });

  it('requires the correct password but never includes it in an error', async () => {
    const encrypted = buildPdf({password: 'correct horse'});
    await expect(extractPdfStatement(encrypted)).rejects.toMatchObject({code: 'PDF_PASSWORD_REQUIRED'});
    await expect(extractPdfStatement(encrypted, {password: 'wrong secret'})).rejects.toMatchObject({
      code: 'PDF_PASSWORD_INVALID',
    });
    await expect(extractPdfStatement(encrypted, {password: 'wrong secret'})).rejects.not.toThrow('wrong secret');
    await expect(extractPdfStatement(encrypted, {password: 'correct horse'})).resolves.toMatchObject({pageCount: 1});
  });

  it('uses typed operational errors', () => {
    expect(new PdfImportError('PDF_LIMIT_EXCEEDED', 'Bounded failure')).toMatchObject({
      name: 'PdfImportError',
      code: 'PDF_LIMIT_EXCEEDED',
    });
  });
});
