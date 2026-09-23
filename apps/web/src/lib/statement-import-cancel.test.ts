import {expect, it} from 'vitest';

import {
  approveStatementImport,
  cancelStatementImport,
  createStatementImportSession,
  getKosharaState,
  stageImportTransactions,
  updateStatementImportItem,
} from './koshara-store';

it('discards pending review data, preserves imported transactions, and allows a new statement', async () => {
  const session = await createStatementImportSession({sourceName: 'Anonymized statement', accountId: 'icici-card'});
  const staged = await stageImportTransactions(session.id, [
    {date: '2026-07-01', description: 'Sample purchase', amountMinor: 2500, kind: 'expense', accountId: 'icici-card', categoryId: 'shopping', source: 'pdf', reviewStatus: 'needs_review'},
    {date: '2026-07-02', description: 'Another sample purchase', amountMinor: 5000, kind: 'expense', accountId: 'icici-card', categoryId: 'uncategorized', source: 'pdf', reviewStatus: 'needs_review'},
  ]);
  await updateStatementImportItem(session.id, staged.items[0]!.id, {approve: true});
  const approved = await approveStatementImport(session.id);
  expect(approved.session.status).toBe('ready_for_review');
  expect(approved.transactions).toHaveLength(1);

  const transactionsBeforeCancel = getKosharaState().transactions;
  const accountsBeforeCancel = getKosharaState().accounts;
  await cancelStatementImport(session.id);
  expect(getKosharaState().importSessions.some(({id}) => id === session.id)).toBe(false);
  expect(getKosharaState().transactions).toBe(transactionsBeforeCancel);
  expect(getKosharaState().accounts).toBe(accountsBeforeCancel);
  await expect(cancelStatementImport(session.id)).rejects.toThrow('not found');

  const next = await createStatementImportSession({sourceName: 'Next anonymized statement', accountId: 'icici-card'});
  expect(next.id).not.toBe(session.id);
  expect(next.status).toBe('draft');
}, 10_000);
