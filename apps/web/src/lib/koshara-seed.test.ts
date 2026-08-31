import {describe, expect, it} from 'vitest';

import {createDemoState, mergeDemoTransactions} from './koshara-seed';
import type {Transaction} from './koshara-types';

const referenceDate = new Date(2026, 7, 31, 12);

describe('rich demo data', () => {
  it('creates the same deterministic ten-month history for the same reference date', () => {
    const first = createDemoState(referenceDate);
    const second = createDemoState(referenceDate);
    const months = new Set(first.transactions.map(({date}) => date.slice(0, 7)));

    expect(first).toEqual(second);
    expect(months).toEqual(new Set([
      '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ]));
    expect(first.transactions.length).toBeGreaterThanOrEqual(200);
  });

  it('covers every seeded category and includes analysis-friendly review and duplicate patterns', () => {
    const state = createDemoState(referenceDate);
    const covered = new Set(state.transactions.map(({categoryId}) => categoryId));
    const current = state.transactions.filter(({date}) => date.startsWith('2026-08'));
    const exactFingerprints = new Map<string, number>();

    state.transactions.forEach((transaction) => {
      const fingerprint = [transaction.date, transaction.amountMinor, transaction.description, transaction.accountId].join('|');
      exactFingerprints.set(fingerprint, (exactFingerprints.get(fingerprint) ?? 0) + 1);
    });

    expect([...state.categories.map(({id}) => id)].every((id) => covered.has(id))).toBe(true);
    expect(current.filter(({categoryId}) => categoryId === 'uncategorized').length).toBeGreaterThanOrEqual(3);
    expect(current.filter(({reviewStatus}) => reviewStatus === 'needs_review').length).toBeGreaterThanOrEqual(4);
    expect([...exactFingerprints.values()].some((count) => count > 1)).toBe(true);
    expect(state.transactions.filter(({description}) => description === 'Salary credit')).toHaveLength(10);
    expect(state.transactions.filter(({description}) => description === 'House rent')).toHaveLength(10);
  });

  it('adds missing demo rows once while preserving user-created and imported rows', () => {
    const seeded = createDemoState(referenceDate).transactions;
    const existingDemo = seeded[0]!;
    const manual: Transaction = {
      ...seeded[1]!,
      id: 'manual-personal-row',
      description: 'My personal transaction',
      source: 'manual',
    };
    const imported: Transaction = {
      ...seeded[2]!,
      id: 'agent-imported-row',
      description: 'Imported personal transaction',
      source: 'agent',
    };

    const once = mergeDemoTransactions([manual, existingDemo, imported], seeded);
    const twice = mergeDemoTransactions(once, seeded);

    expect(once).toHaveLength(seeded.length + 2);
    expect(twice).toEqual(once);
    expect(twice.find(({id}) => id === manual.id)).toEqual(manual);
    expect(twice.find(({id}) => id === imported.id)).toEqual(imported);
    expect(new Set(twice.map(({id}) => id)).size).toBe(twice.length);
  });

  it('does not seed a state that has no demo transactions', () => {
    const seeded = createDemoState(referenceDate).transactions;
    const manual = {...seeded[0]!, id: 'manual-only', source: 'manual' as const};

    expect(mergeDemoTransactions([manual], seeded)).toEqual([manual]);
  });
});
