import {afterEach, describe, expect, it, vi} from 'vitest';
import {createDemoState} from './koshara-seed';
import {getKosharaState, hydrateKosharaStore} from './koshara-store';

afterEach(() => vi.unstubAllGlobals());

describe('single finance store migration', () => {
  it('retains the selected saved data and updates salary credits to ₹1,00,000', () => {
    const state = createDemoState(new Date(2026, 8, 23, 12));
    state.transactions = state.transactions.map((transaction) => transaction.description === 'Salary credit'
      ? {...transaction, amountMinor: 16_500_000} : transaction);
    state.transactions.push({...state.transactions[0]!, id: 'saved-custom-entry', description: 'Saved custom entry', source: 'manual'});
    const values = new Map<string, string>([
      ['koshara.household.v1', 'iyer'],
      ['koshara.finance.v1.iyer', JSON.stringify(state)],
      ['koshara-workspace-log:iyer', '[]'],
    ]);
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
      },
      addEventListener: () => {},
    });

    hydrateKosharaStore();

    expect(getKosharaState().transactions.find(({id}) => id === 'saved-custom-entry')).toBeDefined();
    expect(getKosharaState().transactions.filter(({kind, description}) => kind === 'income' && /salary/i.test(description))
      .every(({amountMinor}) => amountMinor === 10_000_000)).toBe(true);
    expect(values.get('koshara.finance.v1')).toBeDefined();
    expect(values.has('koshara.household.v1')).toBe(false);
    expect(values.get('koshara-workspace-log')).toBe('[]');
  });
});
