import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as pdfjs from 'pdfjs-dist';

import {parseAmountMinor} from './amount';
import {parseStatementDate} from './date';
import {groupIntoLines} from './layout';
import {parseTransactions} from './parse';
import {reconcileStatement} from './reconcile';
import type {PdfTextItem} from './types';

function item(text: string, x: number, y: number): PdfTextItem {
  return {text, x, y, page: 1, width: text.length * 5, height: 9};
}

const header = [item('Date', 10, 500), item('Description', 90, 500), item('Debit', 300, 500), item('Credit', 390, 500), item('Balance', 480, 500)];

describe('statement parsing primitives', () => {
  it('parses negative and comma-formatted currency without floating point cents', () => {
    expect(parseAmountMinor('₹1,234.56')).toBe(123456);
    expect(parseAmountMinor('C 1,234.56')).toBe(123456);
    expect(parseAmountMinor('+ C 1,234.56')).toBe(123456);
    expect(parseAmountMinor('(1,234.56)')).toBe(-123456);
    expect(parseAmountMinor('-12.3')).toBe(-1230);
    expect(parseAmountMinor('not money')).toBeNull();
  });

  it('validates real dates', () => {
    expect(parseStatementDate('03/07/2026')).toBe('2026-07-03');
    expect(parseStatementDate('15/05/2026 | 00:00')).toBe('2026-05-15');
    expect(parseStatementDate('16/05/2026 20:38')).toBe('2026-05-16');
    expect(parseStatementDate('16/05/2026 25:38')).toBeNull();
    expect(parseStatementDate('31/02/2026')).toBeNull();
  });

  it('groups slight Y offsets into a line and sorts by X', () => {
    const lines = groupIntoLines([item('Coffee', 90, 400), item('01/07/2026', 10, 401)]);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe('01/07/2026 Coffee');
  });

  it('reconstructs debit, credit, and continuation while ignoring headers and subtotals', () => {
    const result = parseTransactions([
      ...header,
      item('01/07/2026', 10, 480), item('Sample Store', 90, 480), item('1,200.50', 300, 480), item('8,799.50', 480, 480),
      item('online order', 90, 469),
      item('02/07/2026', 10, 445), item('Refund', 90, 445), item('200.00', 390, 445), item('8,999.50', 480, 445),
      item('Subtotal', 90, 430), item('1,000.50', 300, 430),
    ]);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({date: '2026-07-01', description: 'Sample Store online order', amountMinor: 120050, kind: 'expense', confidence: 0.78});
    expect(result.transactions[1]).toMatchObject({date: '2026-07-02', amountMinor: 20000, kind: 'income'});
    expect(result.unparsedRows).toBe(0);
  });

  it('does not stage malformed dated lines and reports amount-only rows', () => {
    const result = parseTransactions([...header, item('03/07/2026', 10, 480), item('Broken', 90, 480), item('75.00', 300, 460)]);
    expect(result.transactions).toHaveLength(0);
    expect(result.unparsedRows).toBe(2);
    expect(result.reconciliation.status).toBe('warning');
  });

  it('treats a negative amount in a signed amount column as a debit for review', () => {
    const result = parseTransactions([
      item('Date', 10, 500), item('Description', 90, 500), item('Amount', 300, 500), item('Balance', 450, 500),
      item('01/07/2026', 10, 480), item('Example', 90, 480), item('-55.00', 300, 480), item('945.00', 450, 480),
    ]);
    expect(result.transactions[0]).toMatchObject({kind: 'expense', amountMinor: 5500, confidence: 0.55});
  });

  it('honors an explicit CR marker on a credit-card amount', () => {
    const result = parseTransactions([
      item('Date', 10, 500), item('Description', 90, 500), item('Amount', 300, 500), item('Balance', 450, 500),
      item('01/07/2026', 10, 480), item('Payment received', 90, 480), item('INR 1,000.00 CR', 300, 480), item('0.00', 450, 480),
    ], true);
    expect(result.transactions[0]).toMatchObject({kind: 'income', amountMinor: 100000});
  });

  it('reconstructs split PDF currency tokens and descriptions around dated rows', () => {
    const result = parseTransactions([
      item('DATE & TIME', 10, 600), item('TRANSACTION DESCRIPTION', 100, 600), item('AMOUNT', 380, 600),
      item('First merchant', 100, 585),
      item('01/07/2026 | 10:30', 10, 575), item('C', 380, 575), item('100.00', 386, 575),
      item('reference detail', 100, 570),
      item('02/07/2026 | 11:00', 10, 550), item('Refund merchant', 100, 550),
      item('+', 378, 550), item('C', 385, 550), item('25.00', 391, 550),
    ], true);
    expect(result.transactions).toMatchObject([
      {description: 'First merchant reference detail', amountMinor: 10000, kind: 'expense'},
      {description: 'Refund merchant', amountMinor: 2500, kind: 'income'},
    ]);
    expect(result.unparsedRows).toBe(0);
  });

  it('uses the nonzero side of a zero-filled debit and credit pair', () => {
    const result = parseTransactions([
      item('Txn Date', 10, 600), item('Narration', 90, 600), item('Withdrawals', 300, 600), item('Deposits', 390, 600), item('Closing Balance', 480, 600),
      item('01/07/2026', 10, 580), item('Shop Alpha', 90, 580), item('25.00', 300, 580), item('0.00', 390, 580), item('975.00', 480, 580),
      item('02/07/2026', 10, 560), item('Deposit Beta', 90, 560), item('0.00', 300, 560), item('50.00', 390, 560), item('1,025.00', 480, 560),
      item('03/07/2026', 10, 540), item('No movement', 90, 540), item('0.00', 300, 540), item('0.00', 390, 540), item('1,025.00', 480, 540),
    ]);
    expect(result.transactions).toMatchObject([
      {description: 'Shop Alpha', amountMinor: 2500, kind: 'expense'},
      {description: 'Deposit Beta', amountMinor: 5000, kind: 'income'},
    ]);
    expect(result.diagnostics.rejectionReasons.amount).toBe(1);
  });

  it('reconstructs the repository synthetic credit-card PDF by its layout columns', async () => {
    const bytes = new Uint8Array(readFileSync(resolve('public/koshara_demo_credit_card_statement_june_2026.pdf')));
    const task = pdfjs.getDocument({data: bytes});
    const pdf = await task.promise;
    const items: PdfTextItem[] = [];
    try {
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        for (const entry of content.items) {
          if ('str' in entry && entry.str.trim()) items.push({text: entry.str, page: number, x: entry.transform[4], y: entry.transform[5], width: entry.width, height: entry.height});
        }
      }
    } finally {
      await task.destroy();
    }
    const result = parseTransactions(items, true);
    expect(result.transactions).toHaveLength(20);
    expect(result.transactions.filter(({kind}) => kind === 'expense')).toHaveLength(19);
    expect(result.transactions.filter(({kind}) => kind === 'income')).toMatchObject([{description: 'CARD PAYMENT RECEIVED', amountMinor: 4862075}]);
    expect(result.reconciliation.extractedDebitsMinor).toBe(3917468);
    expect(result.unparsedRows).toBe(0);
    expect(result.transactions.some(({description}) => description.includes('Synthetic demo document'))).toBe(false);
    expect(result.reconciliation).toMatchObject({
      status: 'passed',
      openingBalanceMinor: 4862075,
      closingBalanceMinor: 3917468,
      statedDebitsMinor: 3917468,
      statedCreditsMinor: 4862075,
      extractedCreditsMinor: 4862075,
      differenceMinor: 0,
    });
  });
});

describe('reconciliation', () => {
  const rows = [{date: '2026-07-01', description: 'Example', amountMinor: 10000, kind: 'expense' as const, sourcePage: 1, confidence: 0.95}];

  it('passes matching balances and stated totals', () => {
    const lines = groupIntoLines([item('Opening Balance 1,000.00', 10, 500), item('Total Debits 100.00', 10, 470), item('Closing Balance 900.00', 10, 440)]);
    expect(reconcileStatement(lines, rows)).toMatchObject({status: 'passed', differenceMinor: 0, statedDebitsMinor: 10000});
  });

  it('fails a balance mismatch', () => {
    const lines = groupIntoLines([item('Opening Balance 1,000.00', 10, 500), item('Closing Balance 850.00', 10, 440)]);
    expect(reconcileStatement(lines, rows)).toMatchObject({status: 'failed', differenceMinor: 5000});
  });

  it('allows one cent of rounding difference', () => {
    const lines = groupIntoLines([item('Opening Balance 1,000.00', 10, 500), item('Closing Balance 899.99', 10, 440)]);
    expect(reconcileStatement(lines, rows).status).toBe('passed');
  });

  it('does not mistake a credit limit for transaction credits', () => {
    const lines = groupIntoLines([item('Total Credit Limit INR 50,000.00', 10, 500)]);
    expect(reconcileStatement(lines, rows)).toMatchObject({status: 'unavailable', statedCreditsMinor: undefined});
  });

  it('reads summary columns without treating the first transaction balance as the closing balance', () => {
    const lines = groupIntoLines([
      item('Opening Balance', 95, 650), item('1,000.00', 190, 650), item('Limit', 320, 650), item('0.00', 390, 650),
      item('Txn Date', 10, 620), item('Narration', 90, 620), item('Withdrawals', 300, 620), item('Deposits', 390, 620), item('Closing Balance', 480, 620),
      item('01/07/2026', 10, 600), item('Shop Alpha', 90, 600), item('100.00', 300, 600), item('0.00', 390, 600), item('900.00', 480, 600),
      item('02/07/2026', 10, 580), item('Deposit Beta', 90, 580), item('0.00', 300, 580), item('50.00', 390, 580), item('950.00', 480, 580),
      item('Opening Balance', 40, 530), item('Debit Amount', 170, 530), item('Credit Amount', 300, 530), item('Closing Balance', 430, 530),
      item('1,000.00', 40, 514), item('100.00', 170, 514), item('50.00', 300, 514), item('950.00', 430, 514),
    ]);
    const rows = [
      {date: '2026-07-01', description: 'Shop Alpha', amountMinor: 10000, kind: 'expense' as const, balanceMinor: 90000, sourcePage: 1, confidence: 0.95},
      {date: '2026-07-02', description: 'Deposit Beta', amountMinor: 5000, kind: 'income' as const, balanceMinor: 95000, sourcePage: 1, confidence: 0.95},
    ];
    expect(reconcileStatement(lines, rows)).toMatchObject({
      status: 'passed', openingBalanceMinor: 100000, closingBalanceMinor: 95000,
      statedDebitsMinor: 10000, statedCreditsMinor: 5000, differenceMinor: 0,
    });
  });

  it('reads credit-card summary values below intervening subheadings', () => {
    const lines = groupIntoLines([
      item('PREVIOUS STATEMENT DUES', 40, 650), item('PAYMENTS/CREDITS', 155, 650), item('PURCHASES/DEBIT', 260, 650), item('TOTAL AMOUNT DUE', 445, 650),
      item('RECEIVED', 170, 642), item('(Current Billing Cycle)', 255, 642),
      item('C', 63, 625), item('1,000.00', 68, 625),
      item('C', 168, 625), item('200.00', 173, 625),
      item('C', 268, 625), item('50.00', 273, 625),
      item('C', 446, 625), item('850.00', 451, 625),
    ]);
    const rows = [
      {date: '2026-07-01', description: 'Payment', amountMinor: 20000, kind: 'income' as const, sourcePage: 1, confidence: 0.95},
      {date: '2026-07-02', description: 'Purchase', amountMinor: 5000, kind: 'expense' as const, sourcePage: 1, confidence: 0.95},
    ];
    expect(reconcileStatement(lines, rows, true)).toMatchObject({
      status: 'passed', openingBalanceMinor: 100000, closingBalanceMinor: 85000,
      statedDebitsMinor: 5000, statedCreditsMinor: 20000, differenceMinor: 0,
    });
  });
});

describe('anonymized layout fixtures', () => {
  const fixtures: Array<{name: string; creditCard: boolean; items: PdfTextItem[]; expected: string[]}> = [
    {
      name: 'bank with alternate column titles and a running balance', creditCard: false,
      items: [
        item('Posting Date', 12, 600), item('Merchant', 92, 600), item('Withdrawal', 310, 600), item('Deposit', 402, 600), item('Running Balance', 485, 600),
        item('01/07/2026', 12, 580), item('Shop Alpha', 92, 580), item('45.00', 310, 580), item('955.00', 485, 580),
        item('02/07/2026', 12, 560), item('Payroll Beta', 92, 560), item('250.00', 402, 560), item('1,205.00', 485, 560),
        item('Total Debits 45.00', 12, 520), item('Total Credits 250.00', 12, 500),
      ], expected: ['Shop Alpha', 'Payroll Beta'],
    },
    {
      name: 'headerless signed bank export', creditCard: false,
      items: [
        item('Account activity', 10, 700), item('Period July 2026', 10, 680),
        item('03/07/2026', 12, 600), item('Transit Gamma', 110, 600), item('-30.00', 360, 600),
        item('04/07/2026', 12, 580), item('Transfer Delta', 110, 580), item('+75.00', 360, 580),
        item('Footer reference 12345', 10, 520),
      ], expected: ['Transit Gamma', 'Transfer Delta'],
    },
    {
      name: 'headerless credit card with two monetary columns', creditCard: true,
      items: [
        item('Card activity', 10, 700), item('Period July 2026', 10, 680),
        item('05/07/2026', 12, 600), item('Cafe Epsilon', 110, 600), item('120.00', 360, 600), item('120.00', 460, 600),
        item('06/07/2026', 12, 580), item('Store Zeta', 110, 580), item('80.00', 360, 580), item('200.00', 460, 580),
      ], expected: ['Cafe Epsilon', 'Store Zeta'],
    },
    {
      name: 'credit card with timed dates, rewards column, wrapped descriptions, and explicit refund sign', creditCard: true,
      items: [
        item('Domestic Transactions', 188, 610),
        item('DATE & TIME', 198, 590), item('TRANSACTION DESCRIPTION', 305, 590), item('REWARDS', 590, 590), item('AMOUNT', 680, 590), item('PI', 740, 590),
        item('15/05/2026 | 00:00', 198, 560), item('Tax Merchant Alpha', 305, 560), item('₹ 241.56', 680, 560),
        item('reference line', 305, 550),
        item('15/05/2026 | 00:00', 198, 530), item('Tax Merchant Beta', 305, 530), item('₹ 165.60', 680, 530),
        item('15/05/2026 | 00:00', 198, 510), item('Refund Gamma', 305, 510), item('+ ₹ 2,256.00', 680, 510),
        item('16/05/2026 | 20:38', 198, 490), item('Market Delta', 305, 490), item('₹ 110.00', 680, 490),
        item('17/05/2026 | 15:32', 198, 470), item('Store Epsilon', 305, 470), item('₹ 915.50', 680, 470),
      ], expected: ['Tax Merchant Alpha reference line', 'Tax Merchant Beta', 'Refund Gamma', 'Market Delta', 'Store Epsilon'],
    },
    {
      name: 'malformed table rejects dated and amount only rows', creditCard: false,
      items: [
        item('Date', 12, 600), item('Description', 92, 600), item('Debit', 310, 600), item('Credit', 402, 600),
        item('07/07/2026', 12, 580), item('Merchant Eta', 92, 580), item('25.00', 310, 580),
        item('08/07/2026', 12, 560), item('Merchant Theta', 92, 560), item('broken', 310, 560),
        item('Merchant Iota', 92, 540), item('50.00', 310, 540),
      ], expected: ['Merchant Eta'],
    },
  ];

  it.each(fixtures)('$name', ({items, creditCard, expected}) => {
    const result = parseTransactions(items, creditCard);
    expect(result.transactions.map(({description}) => description)).toEqual(expected);
    expect(result.diagnostics.candidateRows).toBeGreaterThanOrEqual(expected.length);
  });

  it('measures fixture row recall and false positives', () => {
    const extracted = fixtures.flatMap(({items, creditCard}) => parseTransactions(items, creditCard).transactions.map(({description}) => description));
    const expected = fixtures.flatMap(({expected}) => expected);
    const truePositives = extracted.filter((description) => expected.includes(description)).length;
    const falsePositives = extracted.length - truePositives;
    expect({expectedRows: expected.length, truePositives, falsePositives, recall: truePositives / expected.length})
      .toEqual({expectedRows: 12, truePositives: 12, falsePositives: 0, recall: 1});
  });

  it('uses the explicit plus sign for a credit card refund without changing amount parsing', () => {
    const fixture = fixtures.find(({name}) => name.startsWith('credit card with timed dates'))!;
    const result = parseTransactions(fixture.items, true);
    expect(result.transactions.find(({description}) => description === 'Refund Gamma')).toMatchObject({kind: 'income', amountMinor: 225600});
  });

  it('distinguishes missing text, missing table, and rejected candidates without storing source text', () => {
    expect(parseTransactions([]).diagnostics.status).toBe('no_text_layer');
    expect(parseTransactions([item('Statement summary with plenty of text but no transaction table', 10, 600)]).diagnostics.status).toBe('no_transaction_table');
    const rejected = parseTransactions([
      item('Date', 12, 600), item('Description', 92, 600), item('Debit', 310, 600),
      item('31/02/2026', 12, 580), item('Merchant Kappa', 92, 580), item('25.00', 310, 580),
    ]);
    expect(rejected.diagnostics.status).toBe('candidate_rows_rejected');
    expect(rejected.diagnostics.rejectionReasons).toEqual({date: 1, description: 0, amount: 0, direction: 0});
    expect(JSON.stringify(rejected.diagnostics)).not.toContain('Merchant');
  });

  it('rejects unsigned headerless bank amounts with uncertain direction', () => {
    const result = parseTransactions([
      item('01/07/2026', 12, 600), item('Merchant Lambda', 100, 600), item('25.00', 350, 600),
      item('02/07/2026', 12, 580), item('Merchant Mu', 100, 580), item('40.00', 350, 580),
    ]);
    expect(result.transactions).toHaveLength(0);
    expect(result.diagnostics).toMatchObject({status: 'candidate_rows_rejected', rejectedRows: 2, detection: 'inferred'});
  });
});
