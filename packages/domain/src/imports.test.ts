import {describe, expect, it} from 'vitest';

import {
  classifyDuplicate,
  DuplicateDetector,
  mapCsvRows,
  parseCsv,
  transactionFingerprint,
  type ComparableTransaction,
} from './imports';

describe('parseCsv', () => {
  it('parses quoted commas, escaped quotes, multiline fields, CRLF, and a UTF-8 BOM', () => {
    const csv = '\uFEFFDate,Description,Amount\r\n01/02/2026,"Cafe, ""Central""",125.50\r\n02/02/2026,"Two\nlines",-10\r\n';

    expect(parseCsv(csv)).toEqual({
      headers: ['Date', 'Description', 'Amount'],
      rows: [
        {rowNumber: 2, values: {Date: '01/02/2026', Description: 'Cafe, "Central"', Amount: '125.50'}},
        {rowNumber: 3, values: {Date: '02/02/2026', Description: 'Two\nlines', Amount: '-10'}},
      ],
    });
  });

  it('rejects malformed quoted fields and duplicate headers', () => {
    expect(() => parseCsv('Date,Amount\n"01/02/2026,10')).toThrow('Unclosed quoted field');
    expect(() => parseCsv('Date,date\n01/02/2026,10')).toThrow('unique');
  });

  it('enforces configured byte, row, column, and field limits', () => {
    expect(() => parseCsv('Date\n01', {maxBytes: 4})).toThrow('byte limit');
    expect(() => parseCsv('Date\n01\n02', {maxRows: 1})).toThrow('row limit');
    expect(() => parseCsv('A,B\n1,2', {maxColumns: 1})).toThrow('column limit');
    expect(() => parseCsv('Date\n1234', {maxFieldLength: 3})).toThrow('field length');
  });
});

describe('mapCsvRows', () => {
  const parsed = parseCsv([
    'When,Narrative,Debit,Credit,Signed',
    '01/02/2026,Groceries,"1,250.75",,',
    '02/01/2026,Refund,,250.25,',
    '31/02/2026,Impossible,10,,',
    '03/02/2026,,10,,',
  ].join('\n'));

  it('uses an explicit day/month format and converts debit and credit to signed minor units', () => {
    const candidates = mapCsvRows(parsed, {
      dateColumn: 'When',
      descriptionColumn: 'Narrative',
      dateFormat: 'dd/MM/yyyy',
      amount: {mode: 'debit-credit', debitColumn: 'Debit', creditColumn: 'Credit'},
    });

    expect(candidates.slice(0, 2)).toMatchObject([
      {rowNumber: 2, transactionDate: '2026-02-01', description: 'Groceries', amountMinor: -125075, validationErrors: []},
      {rowNumber: 3, transactionDate: '2026-01-02', description: 'Refund', amountMinor: 25025, validationErrors: []},
    ]);
    expect(candidates[2]?.validationErrors).toContain('When is not a valid dd/MM/yyyy date');
    expect(candidates[3]?.validationErrors).toContain('Narrative is required');
  });

  it('interprets the same ambiguous value differently with an explicit month/day format', () => {
    const [candidate] = mapCsvRows(parseCsv('Date,Description,Amount\n01/02/2026,Coffee,-10'), {
      dateColumn: 'Date',
      descriptionColumn: 'Description',
      dateFormat: 'MM/dd/yyyy',
      amount: {mode: 'signed', amountColumn: 'Amount'},
    });

    expect(candidate?.transactionDate).toBe('2026-01-02');
    expect(candidate?.amountMinor).toBe(-1000);
  });

  it('rejects mappings that do not match the file headers', () => {
    expect(() => mapCsvRows(parsed, {
      dateColumn: 'Missing',
      descriptionColumn: 'Narrative',
      dateFormat: 'dd/MM/yyyy',
      amount: {mode: 'signed', amountColumn: 'Signed'},
    })).toThrow('Missing is not a CSV column');
  });

  it('marks zero-value transactions invalid before persistence', () => {
    const [candidate] = mapCsvRows(parseCsv('Date,Description,Amount\n01/02/2026,Zero,0.00'), {
      dateColumn: 'Date',
      descriptionColumn: 'Description',
      dateFormat: 'dd/MM/yyyy',
      amount: {mode: 'signed', amountColumn: 'Amount'},
    });

    expect(candidate?.validationErrors).toContain('Transaction amount must not be zero');
  });
});

describe('duplicate classification', () => {
  const existing: ComparableTransaction[] = [
    {
      id: 'transaction-1',
      financialAccountId: 'account-1',
      transactionDate: '2026-02-01',
      description: '  CENTRAL  CAFE ',
      amountMinor: -12500,
    },
  ];

  it('builds a normalised exact fingerprint', () => {
    expect(transactionFingerprint(existing[0]!)).toBe('account-1|2026-02-01|-12500|central cafe');
  });

  it('classifies exact, probable, and new transactions deterministically', () => {
    expect(classifyDuplicate({...existing[0]!, id: 'candidate'} , existing)).toEqual({
      kind: 'exact',
      matchedTransactionId: 'transaction-1',
    });
    expect(classifyDuplicate({
      id: 'candidate',
      financialAccountId: 'account-1',
      transactionDate: '2026-02-03',
      description: 'Cafe Central card purchase',
      amountMinor: -12500,
    }, existing)).toEqual({kind: 'probable', matchedTransactionId: 'transaction-1'});
    expect(classifyDuplicate({
      id: 'candidate',
      financialAccountId: 'account-1',
      transactionDate: '2026-02-10',
      description: 'Cafe Central card purchase',
      amountMinor: -12500,
    }, existing)).toEqual({kind: 'new'});
  });

  it('indexes candidates incrementally for within-session duplicate checks', () => {
    const detector = new DuplicateDetector([]);
    detector.add(existing[0]!);

    expect(detector.classify({...existing[0]!, id: 'candidate-2'})).toEqual({
      kind: 'exact',
      matchedTransactionId: 'transaction-1',
    });
  });
});
