import {describe, expect, it} from 'vitest';

import {getKosharaState} from './koshara-store';
import {KOSHARA_WEBMCP_TOOL_GROUPS, KOSHARA_WEBMCP_TOOLS} from './webmcp-tool-registry';

function tool(name: string) {
  const found = KOSHARA_WEBMCP_TOOLS.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing WebMCP tool: ${name}`);
  return found;
}

describe('statement import WebMCP tools', () => {
  it('checks a batch without changing transactions', async () => {
    const existing = getKosharaState().transactions[0];
    if (!existing) throw new Error('Expected seeded transactions.');
    const beforeCount = getKosharaState().transactions.length;

    const result = await tool('check_transactions').execute({transactions: [
      {
        date: '2020-01-01',
        description: 'Unique statement row',
        amount: 123.45,
        kind: 'expense',
        accountId: 'hdfc-savings',
        categoryId: 'groceries',
      },
      {
        date: existing.date,
        description: existing.description,
        amount: existing.amountMinor / 100,
        kind: existing.kind,
        accountId: existing.accountId,
        categoryId: existing.categoryId,
      },
      {
        date: '2020-01-02',
        description: 'Unknown merchant',
        amount: 450,
        kind: 'expense',
        accountId: 'hdfc-savings',
        categoryId: 'uncategorized',
        reviewStatus: 'needs_review',
      },
      {
        date: 'not-a-date',
        description: '',
        amount: -1,
        kind: 'expense',
        accountId: 'missing-account',
        categoryId: 'missing-category',
      },
    ]}) as {
      summary: {total: number; ready: number; possibleDuplicates: number; needsReview: number; invalid: number};
      results: Array<{status: string; matches?: unknown[]; errors?: unknown[]}>;
    };

    expect(result.summary).toEqual({total: 4, ready: 1, possibleDuplicates: 1, needsReview: 1, invalid: 1});
    expect(result.results.map((row) => row.status)).toEqual(['ready', 'possible_duplicate', 'needs_review', 'invalid']);
    expect(result.results[1]?.matches).not.toHaveLength(0);
    expect(result.results[3]?.errors).not.toHaveLength(0);
    expect(getKosharaState().transactions).toHaveLength(beforeCount);
  });

  it('creates every valid row once and reports invalid rows without losing metadata', async () => {
    const beforeCount = getKosharaState().transactions.length;

    const result = await tool('create_transactions').execute({transactions: [
      {
        date: '2020-02-01',
        description: 'Batch-created transaction',
        amount: 987.65,
        kind: 'expense',
        accountId: 'hdfc-savings',
        categoryId: 'uncategorized',
        notes: 'Imported from statement',
        reviewStatus: 'needs_review',
        source: 'agent',
        confidence: 0.42,
      },
      {
        date: '2020-02-02',
        description: 'Invalid transaction',
        amount: 100,
        kind: 'expense',
        accountId: 'missing-account',
        categoryId: 'groceries',
      },
    ]}) as {
      summary: {requested: number; created: number; failed: number};
      created: Array<{id: string; reviewStatus: string; source: string; confidence?: number}>;
      failed: Array<{index: number; errors: unknown[]}>;
    };

    expect(result.summary).toEqual({requested: 2, created: 1, failed: 1});
    expect(result.created[0]).toMatchObject({reviewStatus: 'needs_review', source: 'agent', confidence: 0.42});
    expect(result.failed[0]).toMatchObject({index: 1});
    expect(getKosharaState().transactions).toHaveLength(beforeCount + 1);
    expect(getKosharaState().transactions.some((transaction) => transaction.id === result.created[0]?.id)).toBe(true);
  });

  it('lists both batch tools in the Transactions group', () => {
    const transactions = KOSHARA_WEBMCP_TOOL_GROUPS.find((group) => group.label === 'Transactions');
    expect(transactions?.names).toContain('check_transactions');
    expect(transactions?.names).toContain('create_transactions');
  });
});
