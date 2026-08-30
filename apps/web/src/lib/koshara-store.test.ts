import {describe, expect, it} from 'vitest';

import {getKosharaState, updateTransaction, updateTransactions} from './koshara-store';

describe('bulk transaction updates', () => {
  it('assigns a category and confirms review status for every selected transaction', async () => {
    await updateTransaction('tx-01', {reviewStatus: 'needs_review'});
    await updateTransaction('tx-02', {reviewStatus: 'needs_review'});

    const updated = await updateTransactions(['tx-01', 'tx-02'], {categoryId: 'groceries', reviewStatus: 'confirmed'});

    expect(updated.map(({id}) => id)).toEqual(['tx-01', 'tx-02']);
    expect(getKosharaState().transactions.filter(({id}) => updated.some((transaction) => transaction.id === id)))
      .toMatchObject([
        {id: 'tx-01', categoryId: 'groceries', reviewStatus: 'confirmed'},
        {id: 'tx-02', categoryId: 'groceries', reviewStatus: 'confirmed'},
      ]);
  });

  it('rejects an empty or unknown selection without changing data', async () => {
    await expect(updateTransactions([], {reviewStatus: 'confirmed'})).rejects.toThrow('Select at least one transaction.');
    await expect(updateTransactions(['missing'], {reviewStatus: 'confirmed'})).rejects.toThrow('One or more selected transactions were not found.');
  });
});
