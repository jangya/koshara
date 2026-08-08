export const csvImportLimits = {
  maxBytes: 2 * 1024 * 1024,
  maxRows: 5_000,
  maxColumns: 100,
  maxFieldLength: 2_000,
} as const;

export type CsvImportLimits = {
  maxBytes: number;
  maxRows: number;
  maxColumns: number;
  maxFieldLength: number;
};

export type ParsedCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedCsv = {
  headers: string[];
  rows: ParsedCsvRow[];
};

export const csvDateFormats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'] as const;
const csvColumnName = z.string().trim().min(1).max(100);
export const csvColumnMappingSchema = z.object({
  dateColumn: csvColumnName,
  descriptionColumn: csvColumnName,
  dateFormat: z.enum(csvDateFormats),
  amount: z.discriminatedUnion('mode', [
    z.object({mode: z.literal('signed'), amountColumn: csvColumnName}).strict(),
    z.object({
      mode: z.literal('debit-credit'),
      debitColumn: csvColumnName,
      creditColumn: csvColumnName,
    }).strict(),
  ]),
}).strict();

export const importCandidateDecisionSchema = z.enum(['include', 'exclude']);
export type CsvColumnMapping = z.infer<typeof csvColumnMappingSchema>;

export type MappedCsvCandidate = {
  rowNumber: number;
  transactionDate: string | null;
  description: string | null;
  amountMinor: number | null;
  validationErrors: string[];
};

export type ComparableTransaction = {
  id: string;
  financialAccountId: string;
  transactionDate: string;
  description: string;
  amountMinor: number;
};

export type DuplicateClassification =
  | {kind: 'new'}
  | {kind: 'exact' | 'probable'; matchedTransactionId: string};

function assertFieldLength(field: string, maxFieldLength: number) {
  if (field.length > maxFieldLength) {
    throw new Error(`CSV field length exceeds the ${maxFieldLength} character limit`);
  }
}

export function parseCsv(input: string, overrides: Partial<CsvImportLimits> = {}): ParsedCsv {
  const limits = {...csvImportLimits, ...overrides};
  const csv = input.startsWith('\uFEFF') ? input.slice(1) : input;
  if (new TextEncoder().encode(csv).byteLength > limits.maxBytes) {
    throw new Error(`CSV exceeds the ${limits.maxBytes} byte limit`);
  }

  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let quotedFieldClosed = false;

  function append(value: string) {
    field += value;
    assertFieldLength(field, limits.maxFieldLength);
  }

  function finishField() {
    record.push(field);
    field = '';
    quotedFieldClosed = false;
    if (record.length > limits.maxColumns) {
      throw new Error(`CSV exceeds the ${limits.maxColumns} column limit`);
    }
  }

  function finishRecord() {
    if (record.length === 0 && field === '') return;
    finishField();
    records.push(record);
    record = [];
    if (records.length - 1 > limits.maxRows) {
      throw new Error(`CSV exceeds the ${limits.maxRows} row limit`);
    }
  }

  for (let index = 0; index <= csv.length; index += 1) {
    const character = index === csv.length ? '\n' : csv[index]!;

    if (inQuotes) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          append('"');
          index += 1;
        } else {
          inQuotes = false;
          quotedFieldClosed = true;
        }
      } else {
        append(character);
      }
      continue;
    }

    if (quotedFieldClosed) {
      if (character === ',') {
        finishField();
      } else if (character === '\n' || character === '\r') {
        finishRecord();
        if (character === '\r' && csv[index + 1] === '\n') index += 1;
      } else {
        throw new Error('Unexpected characters after a quoted CSV field');
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) throw new Error('Unexpected quote in an unquoted CSV field');
      inQuotes = true;
    } else if (character === ',') {
      finishField();
    } else if (character === '\n' || character === '\r') {
      finishRecord();
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
    } else {
      append(character);
    }
  }

  if (inQuotes) throw new Error('Unclosed quoted field in CSV');
  const headerRecord = records[0];
  if (!headerRecord) throw new Error('CSV must include a header row');

  const headers = headerRecord.map((header) => header.trim());
  if (headers.some((header) => header.length === 0)) throw new Error('CSV headers cannot be empty');
  if (new Set(headers.map((header) => header.toLocaleLowerCase('en-US'))).size !== headers.length) {
    throw new Error('CSV headers must be unique');
  }

  const rows = records.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has ${values.length} columns; expected ${headers.length}`);
    }
    return {
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex]!])),
    };
  });
  if (rows.length === 0) throw new Error('CSV must include at least one data row');

  return {headers, rows};
}

export function mapCsvRows(_parsed: ParsedCsv, _mapping: CsvColumnMapping): MappedCsvCandidate[] {
  const requiredColumns = [
    _mapping.dateColumn,
    _mapping.descriptionColumn,
    ...(_mapping.amount.mode === 'signed'
      ? [_mapping.amount.amountColumn]
      : [_mapping.amount.debitColumn, _mapping.amount.creditColumn]),
  ];
  for (const column of requiredColumns) {
    if (!_parsed.headers.includes(column)) throw new Error(`${column} is not a CSV column`);
  }
  if (new Set(requiredColumns).size !== requiredColumns.length) {
    throw new Error('Each mapped transaction field must use a different CSV column');
  }

  return _parsed.rows.map((row) => {
    const validationErrors: string[] = [];
    const rawDate = row.values[_mapping.dateColumn]!.trim();
    const transactionDate = parseDate(rawDate, _mapping.dateFormat);
    if (!transactionDate) {
      validationErrors.push(`${_mapping.dateColumn} is not a valid ${_mapping.dateFormat} date`);
    }

    const rawDescription = row.values[_mapping.descriptionColumn]!.trim();
    let description: string | null = rawDescription || null;
    if (!description) {
      validationErrors.push(`${_mapping.descriptionColumn} is required`);
    } else if (description.length > 500) {
      validationErrors.push(`${_mapping.descriptionColumn} exceeds 500 characters`);
      description = null;
    }

    let amountMinor: number | null = null;
    if (_mapping.amount.mode === 'signed') {
      const rawAmount = row.values[_mapping.amount.amountColumn]!.trim();
      amountMinor = parseAmountMinor(rawAmount);
      if (amountMinor === null) {
        validationErrors.push(`${_mapping.amount.amountColumn} is not a valid amount`);
      }
    } else {
      const rawDebit = row.values[_mapping.amount.debitColumn]!.trim();
      const rawCredit = row.values[_mapping.amount.creditColumn]!.trim();
      if (rawDebit && rawCredit) {
        validationErrors.push(`Only one of ${_mapping.amount.debitColumn} and ${_mapping.amount.creditColumn} may have a value`);
      } else if (!rawDebit && !rawCredit) {
        validationErrors.push(`One of ${_mapping.amount.debitColumn} and ${_mapping.amount.creditColumn} is required`);
      } else {
        const parsedAmount = parseAmountMinor(rawDebit || rawCredit);
        if (parsedAmount === null) {
          validationErrors.push(`${rawDebit ? _mapping.amount.debitColumn : _mapping.amount.creditColumn} is not a valid amount`);
        } else {
          amountMinor = rawDebit ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
        }
      }
    }

    if (amountMinor === 0) validationErrors.push('Transaction amount must not be zero');

    return {rowNumber: row.rowNumber, transactionDate, description, amountMinor, validationErrors};
  });
}

function parseDate(value: string, format: CsvColumnMapping['dateFormat']): string | null {
  const pattern = format === 'yyyy-MM-dd' ? /^(\d{4})-(\d{2})-(\d{2})$/u : /^(\d{2})\/(\d{2})\/(\d{4})$/u;
  const match = pattern.exec(value);
  if (!match) return null;

  const [year, month, day] = format === 'yyyy-MM-dd'
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : format === 'dd/MM/yyyy'
      ? [Number(match[3]), Number(match[2]), Number(match[1])]
      : [Number(match[3]), Number(match[1]), Number(match[2])];
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseAmountMinor(value: string): number | null {
  const trimmed = value.trim();
  const isParenthesized = trimmed.startsWith('(') && trimmed.endsWith(')');
  const unwrapped = isParenthesized ? trimmed.slice(1, -1) : trimmed;
  const match = /^([+-]?)(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?$/u.exec(unwrapped);
  if (!match) return null;

  const whole = Number(match[2]!.replaceAll(',', ''));
  const fraction = Number((match[3] ?? '').padEnd(2, '0'));
  const amount = whole * 100 + fraction;
  if (!Number.isSafeInteger(amount) || amount > 999_999_999_999) return null;
  const negative = isParenthesized || match[1] === '-';
  return negative ? -amount : amount;
}

export function transactionFingerprint(transaction: Omit<ComparableTransaction, 'id'>): string {
  return [
    transaction.financialAccountId,
    transaction.transactionDate,
    transaction.amountMinor,
    normaliseDescription(transaction.description),
  ].join('|');
}

export function classifyDuplicate(
  candidate: ComparableTransaction,
  existing: ComparableTransaction[],
): DuplicateClassification {
  return new DuplicateDetector(existing).classify(candidate);
}

function normaliseDescription(description: string): string {
  return description.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}

export class DuplicateDetector {
  private readonly exact = new Map<string, ComparableTransaction[]>();
  private readonly byAccountAmount = new Map<string, ComparableTransaction[]>();

  constructor(transactions: ComparableTransaction[]) {
    for (const transaction of transactions) this.add(transaction);
  }

  add(transaction: ComparableTransaction) {
    const fingerprint = transactionFingerprint(transaction);
    const exact = this.exact.get(fingerprint);
    if (exact) exact.push(transaction);
    else this.exact.set(fingerprint, [transaction]);
    const amountKey = this.amountKey(transaction);
    const sameAmount = this.byAccountAmount.get(amountKey);
    if (sameAmount) sameAmount.push(transaction);
    else this.byAccountAmount.set(amountKey, [transaction]);
  }

  classify(candidate: ComparableTransaction): DuplicateClassification {
    const exact = this.exact.get(transactionFingerprint(candidate))?.find((transaction) => transaction.id !== candidate.id);
    if (exact) return {kind: 'exact', matchedTransactionId: exact.id};

    const candidateTime = Date.parse(`${candidate.transactionDate}T00:00:00.000Z`);
    const probable = this.byAccountAmount.get(this.amountKey(candidate))?.find((transaction) => {
      if (transaction.id === candidate.id) return false;
      const existingTime = Date.parse(`${transaction.transactionDate}T00:00:00.000Z`);
      return Math.abs(candidateTime - existingTime) <= 3 * 24 * 60 * 60 * 1_000;
    });
    return probable ? {kind: 'probable', matchedTransactionId: probable.id} : {kind: 'new'};
  }

  private amountKey(transaction: ComparableTransaction) {
    return `${transaction.financialAccountId}|${transaction.amountMinor}`;
  }
}
import {z} from 'zod';
