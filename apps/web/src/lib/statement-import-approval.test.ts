import {describe, expect, it} from 'vitest';

import {createStatementImportSession, stageImportTransactions, updateStatementImportItem} from './koshara-store';

describe('PDF statement row approval', () => {
  it('requires explicit approval after a category choice and reopens review after a material edit', async () => {
    const session = await createStatementImportSession({sourceName: 'Synthetic statement', accountId: 'icici-card'});
    const staged = await stageImportTransactions(session.id, [{
      date: '2026-07-01',
      description: 'Anonymized purchase',
      amountMinor: 12500,
      kind: 'expense',
      accountId: 'icici-card',
      categoryId: 'uncategorized',
      reviewStatus: 'needs_review',
      source: 'pdf',
    }]);
    const item = staged.items.at(-1)!;
    expect(item).toMatchObject({status: 'needs_attention', included: false, reviewApproved: false});

    const categorized = await updateStatementImportItem(session.id, item.id, {proposedCategoryId: 'shopping'});
    expect(categorized).toMatchObject({status: 'needs_attention', included: false, reviewApproved: false});

    const approved = await updateStatementImportItem(session.id, item.id, {approve: true});
    expect(approved).toMatchObject({status: 'ready', included: true, reviewApproved: true});

    const edited = await updateStatementImportItem(session.id, item.id, {description: 'Edited purchase'});
    expect(edited).toMatchObject({status: 'needs_attention', included: false, reviewApproved: false});

    const skipped = await updateStatementImportItem(session.id, item.id, {status: 'skipped'});
    expect(skipped).toMatchObject({status: 'skipped', included: false, reviewApproved: false});
    const restored = await updateStatementImportItem(session.id, item.id, {status: 'ready'});
    expect(restored).toMatchObject({status: 'needs_attention', included: false, reviewApproved: false});
  }, 10_000);

  it('keeps WebMCP rows ready under the existing staging contract', async () => {
    const session = await createStatementImportSession({sourceName: 'WebMCP statement', accountId: 'icici-card'});
    const staged = await stageImportTransactions(session.id, [{
      date: '2026-07-02',
      description: 'Anonymized expense',
      amountMinor: 9900,
      kind: 'expense',
      accountId: 'icici-card',
      categoryId: 'shopping',
      source: 'agent',
    }]);
    expect(staged.items.at(-1)).toMatchObject({status: 'ready', included: true});
  });
});
