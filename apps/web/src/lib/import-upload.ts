import {csvImportLimits, parseCsv, type ParsedCsv} from '@koshara/domain';
import {z} from 'zod';

const allowedCsvMimeTypes = new Set(['', 'text/csv', 'text/plain', 'application/vnd.ms-excel']);
const maxFiles = 5;
const maxSessionBytes = maxFiles * csvImportLimits.maxBytes;

export type ParsedCsvUpload = {
  financialAccountId: string;
  files: Array<{originalFilename: string; parsedCsv: ParsedCsv}>;
};

export class CsvUploadValidationError extends Error {}

export async function parseCsvUploadForm(formData: FormData): Promise<ParsedCsvUpload> {
  const financialAccountId = z.uuid().safeParse(formData.get('financialAccountId'));
  if (!financialAccountId.success) throw new CsvUploadValidationError('Choose a valid financial account');

  const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) throw new CsvUploadValidationError('Choose at least one CSV file');
  if (files.length > maxFiles) throw new CsvUploadValidationError('Choose no more than five CSV files');
  if (files.reduce((total, file) => total + file.size, 0) > maxSessionBytes) {
    throw new CsvUploadValidationError('The combined CSV upload is too large');
  }

  return {
    financialAccountId: financialAccountId.data,
    files: await Promise.all(files.map(async (file) => {
      if (file.size === 0) throw new CsvUploadValidationError(`${file.name || 'A CSV file'} cannot be empty`);
      if (file.size > csvImportLimits.maxBytes) throw new CsvUploadValidationError(`${file.name || 'A CSV file'} exceeds the 2 MB limit`);
      if (
        !file.name.toLocaleLowerCase('en-US').endsWith('.csv')
        || !allowedCsvMimeTypes.has(file.type.toLocaleLowerCase('en-US'))
      ) throw new CsvUploadValidationError('Only CSV files are accepted');
      if (file.name.length > 255 || /[/\\\u0000-\u001F]/u.test(file.name)) {
        throw new CsvUploadValidationError('A CSV filename is invalid');
      }

      try {
        return {originalFilename: file.name, parsedCsv: parseCsv(await file.text())};
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The CSV could not be parsed';
        throw new CsvUploadValidationError(`${file.name}: ${message}`);
      }
    })),
  };
}
