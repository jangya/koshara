import type {Account, Category, KosharaState, ReviewStatus, Transaction, TransactionKind} from './koshara-types';

export const demoAccounts: Account[] = [
  {id: 'hdfc-savings', name: 'HDFC Salary Account', institution: 'HDFC Bank', type: 'bank', lastFour: '4821', balanceMinor: 245_180_00, color: 'blue'},
  {id: 'icici-card', name: 'ICICI Amazon Pay Card', institution: 'ICICI Bank', type: 'credit-card', lastFour: '1096', balanceMinor: 38_420_00, color: 'orange'},
  {id: 'cash', name: 'Cash', type: 'cash', balanceMinor: 8_500_00, color: 'green'},
];

export const demoCategories: Category[] = [
  {id: 'groceries', name: 'Groceries', icon: '🛒', budgetMinor: 10_000_00, color: 'green'},
  {id: 'dining', name: 'Dining', icon: '🍽️', budgetMinor: 8_000_00, color: 'orange'},
  {id: 'shopping', name: 'Shopping', icon: '🛍️', budgetMinor: 9_000_00, color: 'pink'},
  {id: 'travel', name: 'Travel', icon: '✈️', budgetMinor: 15_000_00, color: 'teal'},
  {id: 'transport', name: 'Transport', icon: '🚕', budgetMinor: 7_500_00, color: 'blue'},
  {id: 'utilities', name: 'Utilities', icon: '💡', budgetMinor: 5_000_00, color: 'cyan'},
  {id: 'rent', name: 'Rent', icon: '🏠', budgetMinor: 36_000_00, color: 'purple'},
  {id: 'medical', name: 'Medical', icon: '🩺', budgetMinor: 5_000_00, color: 'red'},
  {id: 'entertainment', name: 'Entertainment', icon: '🎬', budgetMinor: null, color: 'pink'},
  {id: 'subscriptions', name: 'Subscriptions', icon: '🔁', budgetMinor: 2_500_00, color: 'yellow'},
  {id: 'education', name: 'Education', icon: '📚', budgetMinor: null, color: 'blue'},
  {id: 'investment', name: 'Investment', icon: '📈', budgetMinor: null, color: 'green'},
  {id: 'transfer', name: 'Transfer', icon: '↔️', budgetMinor: null, color: 'teal'},
  {id: 'cash-withdrawal', name: 'Cash Withdrawal', icon: '🏧', budgetMinor: null, color: 'orange'},
  {id: 'miscellaneous', name: 'Miscellaneous', icon: '📦', budgetMinor: null, color: 'purple'},
  {id: 'income', name: 'Income', icon: '💰', budgetMinor: null, color: 'green'},
  {id: 'uncategorized', name: 'Uncategorized', icon: '❓', budgetMinor: null, color: 'purple'},
];

interface SeedTransactionInput {
  key: string;
  day: number;
  description: string;
  amount: number;
  accountId: string;
  categoryId: string;
  kind?: TransactionKind;
  notes?: string;
  reviewStatus?: ReviewStatus;
  confidence?: number;
}

interface SeedMonth {
  key: string;
  year: number;
  month: number;
  currentMonth: boolean;
  currentDay: number;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function seedMonths(referenceDate: Date): SeedMonth[] {
  return Array.from({length: 10}, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (9 - index), 1, 12);
    return {
      key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`,
      year: date.getFullYear(),
      month: date.getMonth(),
      currentMonth: index === 9,
      currentDay: referenceDate.getDate(),
    };
  });
}

function buildSeedTransaction(month: SeedMonth, input: SeedTransactionInput): Transaction {
  const daysInMonth = new Date(month.year, month.month + 1, 0, 12).getDate();
  const day = Math.min(input.day, daysInMonth, month.currentMonth ? month.currentDay : daysInMonth);
  const date = `${month.key}-${pad(Math.max(1, day))}`;
  return {
    id: `demo-${month.key}-${input.key}`,
    date,
    description: input.description,
    amountMinor: Math.round(input.amount * 100),
    kind: input.kind ?? 'expense',
    accountId: input.accountId,
    categoryId: input.categoryId,
    notes: input.notes ?? '',
    reviewStatus: input.reviewStatus ?? 'confirmed',
    source: 'demo',
    confidence: input.confidence,
    createdAt: `${date}T12:00:00.000Z`,
  };
}

function monthlyTransactions(month: SeedMonth, index: number): Transaction[] {
  const diningIncrease = index * 90;
  const groceries = index === 9
    ? [2_350, 2_180, 2_650, 1_990]
    : [1_780 + index * 25, 1_450 + index * 20, 2_080 + index * 30, 1_290 + index * 15];
  const shoppingSpike = index === 9 ? 12_900 : index === 4 ? 8_450 : 2_490 + (index % 3) * 600;
  const rows: SeedTransactionInput[] = [
    {key: 'salary', day: 1, description: 'Salary credit', amount: 165_000, accountId: 'hdfc-savings', categoryId: 'income', kind: 'income'},
    {key: 'rent', day: 3, description: 'House rent', amount: 34_000, accountId: 'hdfc-savings', categoryId: 'rent'},
    {key: 'sip', day: 4, description: 'Zerodha mutual fund SIP', amount: 15_000, accountId: 'hdfc-savings', categoryId: 'investment'},
    {key: 'self-transfer', day: 5, description: 'Transfer to joint savings', amount: 12_000, accountId: 'hdfc-savings', categoryId: 'transfer'},
    {key: 'grocery-bigbasket', day: 6, description: 'BigBasket', amount: groceries[0]!, accountId: 'hdfc-savings', categoryId: 'groceries'},
    {key: 'grocery-blinkit', day: 12, description: 'Blinkit', amount: groceries[1]!, accountId: 'icici-card', categoryId: 'groceries'},
    {key: 'grocery-reliance', day: 19, description: 'Reliance Fresh', amount: groceries[2]!, accountId: 'hdfc-savings', categoryId: 'groceries'},
    {key: 'grocery-milkbasket', day: 27, description: 'Milkbasket', amount: groceries[3]!, accountId: 'icici-card', categoryId: 'groceries'},
    {key: 'dining-swiggy', day: 7, description: 'Swiggy', amount: 620 + diningIncrease, accountId: 'icici-card', categoryId: 'dining'},
    {key: 'dining-zomato', day: 14, description: 'Zomato', amount: 780 + diningIncrease, accountId: 'icici-card', categoryId: 'dining'},
    {key: 'dining-chaayos', day: 21, description: 'Chaayos', amount: 520 + diningIncrease, accountId: 'icici-card', categoryId: 'dining'},
    {key: 'dining-barbeque', day: 25, description: 'Barbeque Nation', amount: 930 + diningIncrease, accountId: 'icici-card', categoryId: 'dining'},
    {key: 'transport-fuel', day: 8, description: 'Indian Oil fuel', amount: 2_750 + index * 45, accountId: 'hdfc-savings', categoryId: 'transport'},
    {key: 'transport-uber', day: 16, description: 'Uber', amount: 540 + index * 18, accountId: 'icici-card', categoryId: 'transport'},
    {key: 'transport-ola', day: 24, description: 'Ola', amount: 460 + index * 16, accountId: 'icici-card', categoryId: 'transport'},
    {key: 'utility-bescom', day: 9, description: 'BESCOM electricity', amount: 2_180 + (index % 4) * 180, accountId: 'hdfc-savings', categoryId: 'utilities'},
    {key: 'utility-act', day: 11, description: 'ACT Broadband', amount: 999, accountId: 'hdfc-savings', categoryId: 'utilities'},
    {key: 'utility-airtel', day: 18, description: 'Airtel postpaid', amount: 849, accountId: 'icici-card', categoryId: 'utilities'},
    {key: 'subscription-netflix', day: 10, description: 'Netflix', amount: 649, accountId: 'icici-card', categoryId: 'subscriptions'},
    {key: 'subscription-spotify', day: 13, description: 'Spotify', amount: 119, accountId: 'icici-card', categoryId: 'subscriptions'},
    {key: 'subscription-icloud', day: 15, description: 'Apple iCloud', amount: 75, accountId: 'icici-card', categoryId: 'subscriptions'},
    {key: 'entertainment', day: 17, description: index % 2 === 0 ? 'PVR Cinemas' : 'BookMyShow', amount: 1_180 + (index % 3) * 240, accountId: 'icici-card', categoryId: 'entertainment'},
    {key: 'cash-withdrawal', day: 20, description: 'HDFC ATM cash withdrawal', amount: 5_000, accountId: 'hdfc-savings', categoryId: 'cash-withdrawal'},
    {key: 'shopping', day: 22, description: index % 2 === 0 ? 'Amazon India' : 'Myntra', amount: shoppingSpike, accountId: 'icici-card', categoryId: 'shopping'},
    {key: 'shopping-small', day: 28, description: 'Nykaa', amount: 1_490 + index * 50, accountId: 'icici-card', categoryId: 'shopping'},
    {key: 'misc', day: 26, description: 'Urban Company', amount: 899 + (index % 4) * 120, accountId: 'icici-card', categoryId: 'miscellaneous'},
    {key: 'cashback', day: 29, description: 'UPI cashback', amount: 125 + index * 5, accountId: 'hdfc-savings', categoryId: 'miscellaneous', kind: 'income'},
  ];

  if (index % 2 === 0 || index === 9) {
    rows.push({key: 'medical', day: 23, description: index === 9 ? 'Apollo Pharmacy' : 'Practo consultation', amount: 1_850 + index * 90, accountId: 'icici-card', categoryId: 'medical'});
  }
  if (index % 3 === 0 || index === 9) {
    rows.push({key: 'education', day: 18, description: 'Byju’s learning subscription', amount: 3_499, accountId: 'hdfc-savings', categoryId: 'education'});
    rows.push({key: 'travel', day: 8, description: index === 9 ? 'IndiGo' : 'IRCTC', amount: index === 9 ? 14_200 : 5_800 + index * 350, accountId: 'icici-card', categoryId: 'travel'});
  }
  if (index === 2 || index === 7) {
    rows.push({key: 'refund', day: 30, description: 'Amazon refund', amount: 1_299, accountId: 'icici-card', categoryId: 'shopping', kind: 'income'});
  }
  if (index === 9) {
    rows.push(
      {key: 'uncategorized-upi', day: 25, description: 'UPI-MERCHANT 8472', amount: 1_275, accountId: 'hdfc-savings', categoryId: 'uncategorized', reviewStatus: 'needs_review', confidence: 0.42, notes: 'Merchant name is incomplete.'},
      {key: 'uncategorized-pos', day: 26, description: 'POS BLR KIOSK', amount: 860, accountId: 'icici-card', categoryId: 'uncategorized', reviewStatus: 'needs_review', confidence: 0.35, notes: 'Ambiguous card descriptor.'},
      {key: 'uncategorized-neft', day: 27, description: 'NEFT/CR/AX91', amount: 2_450, accountId: 'hdfc-savings', categoryId: 'uncategorized', reviewStatus: 'needs_review', confidence: 0.28, notes: 'Counterparty could not be resolved.'},
      {key: 'review-dining', day: 28, description: 'RSP*FOODHALL', amount: 1_340, accountId: 'icici-card', categoryId: 'dining', reviewStatus: 'needs_review', confidence: 0.58, notes: 'Likely dining; confirm merchant.'},
      {key: 'duplicate-a', day: 30, description: 'Swiggy', amount: 1_430, accountId: 'icici-card', categoryId: 'dining'},
      {key: 'duplicate-b', day: 30, description: 'Swiggy', amount: 1_430, accountId: 'icici-card', categoryId: 'dining', reviewStatus: 'needs_review', confidence: 0.5, notes: 'Possible duplicate charge.'},
    );
  }

  return rows.map((row) => buildSeedTransaction(month, row));
}

export function mergeDemoTransactions(existing: Transaction[], seeded: Transaction[]) {
  if (!existing.some(({source}) => source === 'demo')) return existing;
  const existingIds = new Set(existing.map(({id}) => id));
  const missing = seeded.filter(({id}) => !existingIds.has(id));
  return missing.length === 0 ? existing : [...existing, ...missing];
}

export function createDemoState(referenceDate = new Date()): KosharaState {
  const months = seedMonths(referenceDate);
  const currentMonth = months.at(-1)!;
  const legacyCompatibilityTransactions = [
    {...buildSeedTransaction(currentMonth, {key: 'legacy-swiggy', day: 28, description: 'Swiggy', amount: 1_240, accountId: 'icici-card', categoryId: 'dining'}), id: 'tx-01'},
    {...buildSeedTransaction(currentMonth, {key: 'legacy-bigbasket', day: 27, description: 'BigBasket', amount: 3_480, accountId: 'hdfc-savings', categoryId: 'groceries'}), id: 'tx-02'},
  ];
  return {
    accounts: demoAccounts.map((account) => ({...account})),
    categories: demoCategories.map((category) => ({...category})),
    transactions: [...months.flatMap(monthlyTransactions), ...legacyCompatibilityTransactions],
    importSessions: [],
  };
}
