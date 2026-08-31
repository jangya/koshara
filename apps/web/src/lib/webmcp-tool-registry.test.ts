import {describe, expect, it} from 'vitest';

import {getKosharaState} from './koshara-store';
import {getWebMCPPageContext, KOSHARA_WEBMCP_TOOL_GROUPS, KOSHARA_WEBMCP_TOOLS} from './webmcp-tool-registry';

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

describe('category budget WebMCP contracts', () => {
  it('searches categories and exposes the search tool on the Categories page', () => {
    const result = tool('search_categories').execute({query: 'din', limit: 5}) as {
      count: number;
      categories: Array<{id: string; name: string; monthlyBudget: number | null}>;
    };
    const context = getWebMCPPageContext('/categories');

    expect(result).toMatchObject({count: 1, categories: [{id: 'dining', name: 'Dining', monthlyBudget: 8000}]});
    expect(context?.groups[0]?.names).toContain('search_categories');
    expect(context?.tools.map(({name}) => name)).toContain('search_categories');
  });

  it('exposes monthlyBudget on category results and as an optional create/update field', async () => {
    const listed = await tool('list_categories').execute({}) as Array<{id: string; monthlyBudget: number | null}>;
    const createSchema = tool('create_category').inputSchema as {properties: Record<string, unknown>; required?: string[]};
    const updateSchema = tool('update_category').inputSchema as {properties: Record<string, unknown>; required?: string[]};

    expect(listed.find((category) => category.id === 'dining')?.monthlyBudget).toBe(8000);
    expect(createSchema.properties).toHaveProperty('monthlyBudget');
    expect(createSchema.required).toEqual(['name']);
    expect(updateSchema.properties).toHaveProperty('monthlyBudget');
    expect(updateSchema.required).toEqual(['id']);
  });

  it('persists a created budget, allows clearing it, and keeps omitted budgets optional', async () => {
    const suffix = Date.now().toString(36);
    const created = await tool('create_category').execute({name: `Budget test ${suffix}`, monthlyBudget: 2500}) as {id: string; monthlyBudget: number | null};
    expect(created.monthlyBudget).toBe(2500);

    const cleared = await tool('update_category').execute({id: created.id, monthlyBudget: null}) as {monthlyBudget: number | null};
    expect(cleared.monthlyBudget).toBeNull();

    const legacy = await tool('create_category').execute({name: `Legacy test ${suffix}`}) as {monthlyBudget: number | null};
    expect(legacy.monthlyBudget).toBeNull();
  });
});

describe('spending insight WebMCP facts', () => {
  it('keeps legacy summary fields and adds budgets, trends, attention, merchants, recurring activity, and duplicates', async () => {
    const result = await tool('get_spending_summary').execute({from: '2026-08-01', to: '2026-08-31'}) as {
      currency: string;
      from: string;
      to: string;
      totalSpend: number;
      transactionCount: number;
      totalsByCategory: unknown[];
      categoryDetails: Array<{
        categoryId: string;
        monthlyBudget: number | null;
        periodBudget: number | null;
        budgetStatus: string | null;
        transactionCount: number;
        monthlyTrend: unknown[];
        topMerchants: unknown[];
        recurringPayments: string[];
      }>;
      attention: {needsReview: {count: number}; uncategorized: {count: number}; combined: {count: number}};
      possibleDuplicateGroups: Array<{transactionIds: string[]}>;
    };

    expect(result).toMatchObject({currency: 'INR', from: '2026-08-01', to: '2026-08-31'});
    expect(result.totalSpend).toBeGreaterThan(0);
    expect(result.transactionCount).toBeGreaterThan(0);
    expect(result.totalsByCategory.length).toBeGreaterThan(0);
    expect(result.categoryDetails.find(({categoryId}) => categoryId === 'shopping')).toMatchObject({
      monthlyBudget: 9000,
      periodBudget: 9000,
      budgetStatus: 'Over budget',
    });
    expect(result.categoryDetails.find(({categoryId}) => categoryId === 'dining')?.monthlyTrend).toHaveLength(6);
    expect(result.categoryDetails.find(({categoryId}) => categoryId === 'subscriptions')?.recurringPayments).toContain('Netflix');
    expect(result.attention.needsReview.count).toBeGreaterThan(0);
    expect(result.attention.uncategorized.count).toBeGreaterThan(0);
    expect(result.attention.combined.count).toBeLessThan(result.attention.needsReview.count + result.attention.uncategorized.count);
    expect(result.possibleDuplicateGroups.some(({transactionIds}) => transactionIds.length > 1)).toBe(true);
  });

  it('rejects invalid or reversed date ranges at the tool boundary', () => {
    expect(() => tool('get_spending_summary').execute({from: 'not-a-date', to: '2026-08-31'})).toThrow('from and to must be valid');
    expect(() => tool('get_spending_summary').execute({from: '2026-09-01', to: '2026-08-31'})).toThrow('from must be on or before to');
  });
});
