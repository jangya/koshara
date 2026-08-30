import type {Account, Category, KosharaState, Transaction, TransactionKind} from './koshara-types';

export const demoAccounts: Account[] = [
  {id: 'hdfc-savings', name: 'HDFC Salary Account', institution: 'HDFC Bank', type: 'bank', lastFour: '4821', balanceMinor: 245_180_00, color: 'blue'},
  {id: 'icici-card', name: 'ICICI Amazon Pay Card', institution: 'ICICI Bank', type: 'credit-card', lastFour: '1096', balanceMinor: 38_420_00, color: 'orange'},
  {id: 'cash', name: 'Cash', type: 'cash', balanceMinor: 0, color: 'green'},
];

export const demoCategories: Category[] = [
  {id: 'groceries', name: 'Groceries', budgetMinor: 10_000_00, color: 'green'},
  {id: 'dining', name: 'Dining', budgetMinor: 8_000_00, color: 'orange'},
  {id: 'shopping', name: 'Shopping', budgetMinor: 9_000_00, color: 'pink'},
  {id: 'travel', name: 'Travel', budgetMinor: 15_000_00, color: 'teal'},
  {id: 'transport', name: 'Transport', budgetMinor: 7_500_00, color: 'blue'},
  {id: 'utilities', name: 'Utilities', budgetMinor: 5_000_00, color: 'cyan'},
  {id: 'rent', name: 'Rent', budgetMinor: 36_000_00, color: 'purple'},
  {id: 'medical', name: 'Medical', budgetMinor: 5_000_00, color: 'red'},
  {id: 'entertainment', name: 'Entertainment', budgetMinor: null, color: 'pink'},
  {id: 'subscriptions', name: 'Subscriptions', budgetMinor: 2_500_00, color: 'yellow'},
  {id: 'education', name: 'Education', budgetMinor: null, color: 'blue'},
  {id: 'investment', name: 'Investment', budgetMinor: null, color: 'green'},
  {id: 'transfer', name: 'Transfer', budgetMinor: null, color: 'teal'},
  {id: 'cash-withdrawal', name: 'Cash Withdrawal', budgetMinor: null, color: 'orange'},
  {id: 'miscellaneous', name: 'Miscellaneous', budgetMinor: null, color: 'purple'},
  {id: 'income', name: 'Income', budgetMinor: null, color: 'green'},
  {id: 'uncategorized', name: 'Uncategorized', budgetMinor: null, color: 'purple'},
];

function dateFor(monthOffset: number, day: number) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, day, 12);
  return date.toISOString().slice(0, 10);
}

function transaction(
  id: string,
  monthOffset: number,
  day: number,
  description: string,
  amount: number,
  accountId: string,
  categoryId: string,
  kind: TransactionKind = 'expense',
): Transaction {
  return {
    id,
    date: dateFor(monthOffset, day),
    description,
    amountMinor: Math.round(amount * 100),
    kind,
    accountId,
    categoryId,
    notes: '',
    reviewStatus: 'confirmed',
    source: 'demo',
    createdAt: new Date().toISOString(),
  };
}

export function createDemoState(): KosharaState {
  const transactions = [
    transaction('tx-01', 0, 28, 'Swiggy', 1240, 'icici-card', 'dining'),
    transaction('tx-02', 0, 27, 'BigBasket', 3480, 'hdfc-savings', 'groceries'),
    transaction('tx-03', 0, 26, 'Uber', 640, 'icici-card', 'transport'),
    transaction('tx-04', 0, 24, 'Amazon India', 2899, 'icici-card', 'shopping'),
    transaction('tx-05', 0, 22, 'BESCOM electricity', 2680, 'hdfc-savings', 'utilities'),
    transaction('tx-06', 0, 20, 'Indian Oil fuel', 3200, 'hdfc-savings', 'transport'),
    transaction('tx-07', 0, 18, 'Apollo Pharmacy', 1850, 'icici-card', 'medical'),
    transaction('tx-08', 0, 16, 'Zomato', 920, 'icici-card', 'dining'),
    transaction('tx-09', 0, 14, 'Blinkit', 890, 'hdfc-savings', 'groceries'),
    transaction('tx-10', 0, 12, 'Netflix', 649, 'icici-card', 'subscriptions'),
    transaction('tx-11', 0, 10, 'Flipkart', 4590, 'icici-card', 'shopping'),
    transaction('tx-12', 0, 8, 'IndiGo', 12840, 'icici-card', 'travel'),
    transaction('tx-13', 0, 5, 'House rent', 34000, 'hdfc-savings', 'rent'),
    transaction('tx-14', 0, 1, 'Salary credit', 165000, 'hdfc-savings', 'income', 'income'),
    transaction('tx-15', -1, 27, 'Ola', 510, 'icici-card', 'transport'),
    transaction('tx-16', -1, 25, 'Swiggy', 980, 'icici-card', 'dining'),
    transaction('tx-17', -1, 23, 'BigBasket', 3120, 'hdfc-savings', 'groceries'),
    transaction('tx-18', -1, 21, 'ACT Broadband', 1299, 'hdfc-savings', 'utilities'),
    transaction('tx-19', -1, 18, 'Amazon India', 1599, 'icici-card', 'shopping'),
    transaction('tx-20', -1, 15, 'Cult.fit', 1499, 'icici-card', 'medical'),
    transaction('tx-21', -1, 13, 'Zomato', 760, 'icici-card', 'dining'),
    transaction('tx-22', -1, 10, 'HP fuel station', 2800, 'hdfc-savings', 'transport'),
    transaction('tx-23', -1, 8, 'Myntra', 3290, 'icici-card', 'shopping'),
    transaction('tx-24', -1, 6, 'House rent', 34000, 'hdfc-savings', 'rent'),
    transaction('tx-25', -1, 4, 'Tata Play', 450, 'hdfc-savings', 'subscriptions'),
    transaction('tx-26', -1, 2, 'Salary credit', 165000, 'hdfc-savings', 'income', 'income'),
  ];

  return {
    accounts: demoAccounts.map((account) => ({...account})),
    categories: demoCategories.map((category) => ({...category})),
    transactions,
    importSessions: [],
  };
}
