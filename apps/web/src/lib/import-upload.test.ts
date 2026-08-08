import {describe, expect, it} from 'vitest';

import {parseCsvUploadForm} from './import-upload';

const accountId = '11111111-1111-4111-8111-111111111111';

function uploadForm(files: File[]) {
  const form = new FormData();
  form.set('financialAccountId', accountId);
  for (const file of files) form.append('files', file);
  return form;
}

describe('parseCsvUploadForm', () => {
  it('validates the account id and parses multiple bounded CSV files', async () => {
    const result = await parseCsvUploadForm(uploadForm([
      new File(['Date,Description,Amount\n01/02/2026,Coffee,-10'], 'january.csv', {type: 'text/csv'}),
      new File(['Date,Description,Amount\n02/02/2026,Tea,-20'], 'february.csv', {type: 'text/csv'}),
    ]));

    expect(result).toMatchObject({
      financialAccountId: accountId,
      files: [
        {originalFilename: 'january.csv', parsedCsv: {headers: ['Date', 'Description', 'Amount']}},
        {originalFilename: 'february.csv'},
      ],
    });
  });

  it('rejects missing, excessive, non-CSV, empty, and oversized uploads', async () => {
    await expect(parseCsvUploadForm(uploadForm([]))).rejects.toThrow('one CSV');
    await expect(parseCsvUploadForm(uploadForm(Array.from({length: 6}, (_, index) =>
      new File(['A\n1'], `${index}.csv`, {type: 'text/csv'}),
    )))).rejects.toThrow('five CSV');
    await expect(parseCsvUploadForm(uploadForm([
      new File(['A\n1'], 'statement.pdf', {type: 'application/pdf'}),
    ]))).rejects.toThrow('CSV files');
    await expect(parseCsvUploadForm(uploadForm([
      new File([], 'empty.csv', {type: 'text/csv'}),
    ]))).rejects.toThrow('cannot be empty');
    await expect(parseCsvUploadForm(uploadForm([
      new File(['x'.repeat(2 * 1024 * 1024 + 1)], 'large.csv', {type: 'text/csv'}),
    ]))).rejects.toThrow('2 MB');
  });
});
