import {buildAttentionSummary, buildCategoryAnalytics, findPossibleDuplicateGroups} from './category-analytics';
import {configureCashflowChart, type CashflowChartConfiguration, type CashflowChartMode} from './cashflow-chart';
import {configureCategorySpendingChart, type CategorySpendingChartConfiguration} from './category-spending-chart';
import {isValidIsoDate} from './date-range';
import type {TimelineGrouping} from './date-range';
import {
  createAccount,
  createCategory,
  createTransaction,
  createTransactions,
  createStatementImportSession,
  deleteAccount,
  deleteCategory,
  deleteTransaction,
  getKosharaState,
  groupStatementImportItems,
  stageImportTransactions,
  updateAccount,
  updateCategory,
  updateStatementImportItem,
  updateTransaction,
  validateTransaction,
} from './koshara-store';
import type {
  Account,
  AccountInput,
  AccountType,
  Category,
  CategoryInput,
  ImportSession,
  ReviewStatus,
  Transaction,
  TransactionInput,
  TransactionKind,
  TransactionSource,
} from './koshara-types';

export type ToolArguments = Record<string, unknown>;
export type WebMCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {readOnlyHint: boolean};
  execute: (args: ToolArguments) => unknown | Promise<unknown>;
};

export const KOSHARA_WEBMCP_TOOL_GROUPS = [
  {label: 'Accounts', names: ['get_accounts', 'create_account', 'update_account', 'delete_account']},
  {label: 'Categories', names: ['list_categories', 'create_category', 'update_category', 'delete_category']},
  {label: 'Transactions', names: ['search_transactions', 'get_transaction', 'validate_transaction', 'check_transactions', 'find_possible_duplicates', 'create_transaction', 'create_transactions', 'update_transaction', 'delete_transaction']},
  {label: 'Insights', names: ['get_spending_summary']},
  {label: 'Chart presentation', names: ['configure_cashflow_chart', 'configure_category_spending_chart']},
] as const;

const emptySchema = {type: 'object', properties: {}, additionalProperties: false};
const readOnly = {readOnlyHint: true};
const mutating = {readOnlyHint: false};
const accountTypes: AccountType[] = ['bank', 'credit-card', 'cash', 'wallet', 'other'];
const reviewStatuses: ReviewStatus[] = ['confirmed', 'needs_review'];
const sources: TransactionSource[] = ['manual', 'agent'];
const cashflowChartModes: CashflowChartMode[] = ['combined', 'spending', 'income'];
const timelineGroupings: TimelineGrouping[] = ['daily', 'weekly', 'monthly'];
const proposedTransactionProperties = {
  date: {type: 'string', description: 'YYYY-MM-DD date.'},
  description: {type: 'string'},
  amount: {type: 'number', exclusiveMinimum: 0, description: 'Positive amount in INR.'},
  kind: {type: 'string', enum: ['expense', 'income'], default: 'expense'},
  accountId: {type: 'string'},
  categoryId: {type: 'string'},
  notes: {type: 'string'},
  reviewStatus: {type: 'string', enum: reviewStatuses, default: 'confirmed'},
  source: {type: 'string', enum: sources, default: 'agent'},
  confidence: {type: 'number', minimum: 0, maximum: 1},
};
const proposedTransactionSchema = {
  type: 'object',
  properties: proposedTransactionProperties,
  required: ['date', 'description', 'amount', 'accountId', 'categoryId'],
  additionalProperties: false,
};

function optionalString(args: ToolArguments, key: string) {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requiredString(args: ToolArguments, key: string) {
  const value = optionalString(args, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalAmountMinor(args: ToolArguments) {
  if (args.amount === undefined) return undefined;
  if (typeof args.amount !== 'number' || !Number.isFinite(args.amount)) throw new Error('amount must be a number.');
  return Math.round(args.amount * 100);
}

function requiredAmountMinor(args: ToolArguments) {
  const value = optionalAmountMinor(args);
  if (value === undefined) throw new Error('amount is required.');
  return value;
}

function optionalStringArray(args: ToolArguments, key: string) {
  const value = args[key];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${key} must be an array of non-empty strings.`);
  }
  return [...new Set(value.map((item) => item.trim()))];
}

function parseCashflowChartConfiguration(args: ToolArguments): CashflowChartConfiguration {
  const state = getKosharaState();
  const mode = args.mode === undefined ? 'combined' : args.mode;
  const grouping = args.grouping === undefined ? 'daily' : args.grouping;
  if (!cashflowChartModes.includes(mode as CashflowChartMode)) throw new Error('mode must be combined, spending, or income.');
  if (!timelineGroupings.includes(grouping as TimelineGrouping)) throw new Error('grouping must be daily, weekly, or monthly.');

  let dateRange: CashflowChartConfiguration['dateRange'];
  if (args.dateRange !== undefined) {
    if (!args.dateRange || typeof args.dateRange !== 'object' || Array.isArray(args.dateRange)) throw new Error('dateRange must include from and to.');
    const value = args.dateRange as ToolArguments;
    const from = requiredString(value, 'from');
    const to = requiredString(value, 'to');
    if (!isValidIsoDate(from) || !isValidIsoDate(to)) throw new Error('dateRange from and to must be valid YYYY-MM-DD dates.');
    if (from > to) throw new Error('dateRange from must be on or before to.');
    dateRange = {from, to};
  }

  const accountIds = optionalStringArray(args, 'accountIds');
  const categoryIds = optionalStringArray(args, 'categoryIds');
  const highlightedCategoryIds = optionalStringArray(args, 'highlightedCategoryIds');
  const highlightedDates = optionalStringArray(args, 'highlightedDates');
  const knownAccountIds = new Set(state.accounts.map(({id}) => id));
  const knownCategoryIds = new Set(state.categories.map(({id}) => id));
  const unknownAccounts = accountIds.filter((id) => !knownAccountIds.has(id));
  const unknownCategories = [...categoryIds, ...highlightedCategoryIds].filter((id) => !knownCategoryIds.has(id));
  if (unknownAccounts.length > 0) throw new Error(`Unknown accountIds: ${unknownAccounts.join(', ')}.`);
  if (unknownCategories.length > 0) throw new Error(`Unknown categoryIds: ${[...new Set(unknownCategories)].join(', ')}.`);
  if (highlightedDates.some((date) => !isValidIsoDate(date))) throw new Error('highlightedDates must contain valid YYYY-MM-DD dates.');
  if (args.comparePreviousPeriod !== undefined && typeof args.comparePreviousPeriod !== 'boolean') throw new Error('comparePreviousPeriod must be a boolean.');
  const insightTitle = optionalString(args, 'insightTitle');
  if (insightTitle && insightTitle.length > 120) throw new Error('insightTitle must be 120 characters or fewer.');

  return {
    mode: mode as CashflowChartMode,
    grouping: grouping as TimelineGrouping,
    dateRange,
    accountIds,
    categoryIds,
    comparePreviousPeriod: args.comparePreviousPeriod === true,
    highlightedDates,
    highlightedCategoryIds,
    insightTitle,
  };
}

function parseCategorySpendingChartConfiguration(args: ToolArguments): CategorySpendingChartConfiguration {
  const state = getKosharaState();
  let dateRange: CategorySpendingChartConfiguration['dateRange'];
  if (args.dateRange !== undefined) {
    if (!args.dateRange || typeof args.dateRange !== 'object' || Array.isArray(args.dateRange)) throw new Error('dateRange must include from and to.');
    const value = args.dateRange as ToolArguments;
    const from = requiredString(value, 'from');
    const to = requiredString(value, 'to');
    if (!isValidIsoDate(from) || !isValidIsoDate(to)) throw new Error('dateRange from and to must be valid YYYY-MM-DD dates.');
    if (from > to) throw new Error('dateRange from must be on or before to.');
    dateRange = {from, to};
  }
  const accountIds = optionalStringArray(args, 'accountIds');
  const categoryIds = optionalStringArray(args, 'categoryIds');
  const highlightedCategoryIds = optionalStringArray(args, 'highlightedCategoryIds');
  const knownAccountIds = new Set(state.accounts.map(({id}) => id));
  const knownCategoryIds = new Set(state.categories.map(({id}) => id));
  const unknownAccounts = accountIds.filter((id) => !knownAccountIds.has(id));
  const unknownCategories = [...categoryIds, ...highlightedCategoryIds].filter((id) => !knownCategoryIds.has(id));
  if (unknownAccounts.length > 0) throw new Error(`Unknown accountIds: ${unknownAccounts.join(', ')}.`);
  if (unknownCategories.length > 0) throw new Error(`Unknown categoryIds: ${[...new Set(unknownCategories)].join(', ')}.`);
  const insightTitle = optionalString(args, 'insightTitle');
  if (insightTitle && insightTitle.length > 120) throw new Error('insightTitle must be 120 characters or fewer.');
  return {dateRange, accountIds, categoryIds, highlightedCategoryIds, insightTitle};
}

function parseKind(value: unknown, fallback?: TransactionKind) {
  if (value === undefined) return fallback;
  if (value !== 'expense' && value !== 'income') throw new Error('kind must be expense or income.');
  return value;
}

function parseReviewStatus(value: unknown, fallback?: ReviewStatus) {
  if (value === undefined) return fallback;
  if (!reviewStatuses.includes(value as ReviewStatus)) throw new Error('reviewStatus must be confirmed or needs_review.');
  return value as ReviewStatus;
}

function parseSource(value: unknown, fallback?: TransactionSource) {
  if (value === undefined) return fallback;
  if (!sources.includes(value as TransactionSource)) throw new Error('source must be manual or agent.');
  return value as TransactionSource;
}

function optionalConfidence(args: ToolArguments) {
  if (args.confidence === undefined) return undefined;
  if (typeof args.confidence !== 'number' || !Number.isFinite(args.confidence)) throw new Error('confidence must be a number between 0 and 1.');
  return args.confidence;
}

function parseAccountType(value: unknown) {
  if (!accountTypes.includes(value as AccountType)) throw new Error('type must be bank, credit-card, cash, wallet, or other.');
  return value as AccountType;
}

function accountResult(account: Account) {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    last4: account.lastFour,
    institution: account.institution,
  };
}

function categoryResult(category: Category) {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    monthlyBudget: category.budgetMinor === null ? null : category.budgetMinor / 100,
    currency: 'INR',
  };
}

function optionalMonthlyBudgetMinor(args: ToolArguments) {
  if (!Object.hasOwn(args, 'monthlyBudget')) return undefined;
  if (args.monthlyBudget === null) return null;
  if (typeof args.monthlyBudget !== 'number' || !Number.isFinite(args.monthlyBudget) || args.monthlyBudget < 0) {
    throw new Error('monthlyBudget must be a non-negative INR amount or null.');
  }
  return Math.round(args.monthlyBudget * 100);
}

function transactionResult(transaction: Transaction) {
  const state = getKosharaState();
  return {
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amountMinor / 100,
    currency: 'INR',
    kind: transaction.kind,
    accountId: transaction.accountId,
    account: state.accounts.find((account) => account.id === transaction.accountId)?.name,
    categoryId: transaction.categoryId,
    category: state.categories.find((category) => category.id === transaction.categoryId)?.name,
    notes: transaction.notes || undefined,
    reviewStatus: transaction.reviewStatus,
    source: transaction.source,
    confidence: transaction.confidence,
    createdAt: transaction.createdAt,
  };
}

function transactionInput(args: ToolArguments): TransactionInput {
  return {
    date: requiredString(args, 'date'),
    description: requiredString(args, 'description'),
    amountMinor: requiredAmountMinor(args),
    kind: parseKind(args.kind, 'expense') ?? 'expense',
    accountId: requiredString(args, 'accountId'),
    categoryId: requiredString(args, 'categoryId'),
    notes: typeof args.notes === 'string' ? args.notes : undefined,
    reviewStatus: parseReviewStatus(args.reviewStatus, 'confirmed'),
    source: parseSource(args.source, 'agent'),
    confidence: optionalConfidence(args),
  };
}

function proposedTransactionResult(candidate: TransactionInput) {
  return {
    date: candidate.date,
    description: candidate.description,
    amount: candidate.amountMinor / 100,
    kind: candidate.kind,
    accountId: candidate.accountId,
    categoryId: candidate.categoryId,
    notes: candidate.notes,
    reviewStatus: candidate.reviewStatus,
    source: candidate.source,
    confidence: candidate.confidence,
  };
}

function importSessionResult(session: ImportSession) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    sourceName: session.sourceName,
    accountId: session.accountId,
    status: session.status,
    summary: {
      total: session.items.length,
      ready: session.items.filter(({status}) => status === 'ready').length,
      needsAttention: session.items.filter(({status}) => status === 'needs_attention').length,
      possibleDuplicates: session.items.filter(({status}) => status === 'possible_duplicate').length,
      skipped: session.items.filter(({status}) => status === 'skipped').length,
      suggestedGroups: session.groups.filter(({resolution}) => resolution === 'proposed').length,
    },
    items: session.items.map((item) => ({
      ...item,
      amount: item.amountMinor / 100,
      amountMinor: undefined,
    })),
    groups: session.groups.map((group) => ({
      ...group,
      proposedAmount: group.proposedAmountMinor / 100,
      proposedAmountMinor: undefined,
    })),
    approvedTransactionIds: session.approvedTransactionIds,
  };
}

function transactionBatch(args: ToolArguments) {
  if (!Array.isArray(args.transactions)) throw new Error('transactions must be an array.');
  return args.transactions;
}

function parseProposedTransaction(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {errors: [{code: 'invalid_input', message: 'Transaction must be an object.'}]};
  }
  try {
    return {candidate: transactionInput(value as ToolArguments)};
  } catch (error) {
    return {errors: [{code: 'invalid_input', message: error instanceof Error ? error.message : 'Transaction is invalid.'}]};
  }
}

function monthBounds() {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1, 12).toISOString().slice(0, 10),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 12).toISOString().slice(0, 10),
  };
}

function normalizeDescription(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function descriptionsAreSimilar(left: string, right: string) {
  const a = normalizeDescription(left);
  const b = normalizeDescription(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aWords = new Set(a.split(' ').filter((word) => word.length > 2));
  const bWords = new Set(b.split(' ').filter((word) => word.length > 2));
  const shared = [...aWords].filter((word) => bWords.has(word)).length;
  return shared > 0 && shared / Math.max(aWords.size, bWords.size) >= 0.5;
}

function possibleDuplicateMatches(candidate: Pick<TransactionInput, 'date' | 'description' | 'amountMinor' | 'accountId'>) {
  return getKosharaState().transactions.flatMap((transaction) => {
    const daysApart = Math.abs(new Date(`${transaction.date}T00:00:00Z`).getTime() - new Date(`${candidate.date}T00:00:00Z`).getTime()) / 86_400_000;
    if (transaction.accountId !== candidate.accountId || transaction.amountMinor !== candidate.amountMinor || daysApart > 3 || !descriptionsAreSimilar(transaction.description, candidate.description)) return [];
    return [{...transactionResult(transaction), daysApart, matchReasons: ['same_account', 'same_amount', daysApart === 0 ? 'same_date' : 'nearby_date', 'similar_description']}];
  });
}

export const KOSHARA_WEBMCP_TOOLS: WebMCPTool[] = [
  {
    name: 'get_accounts',
    description: 'Returns available Koshara accounts. When importing a statement, call this once and map all transactions to the appropriate existing account. Do not invent or silently create an account when the correct account is uncertain.',
    inputSchema: emptySchema,
    annotations: readOnly,
    execute: () => getKosharaState().accounts.map(accountResult),
  },
  {
    name: 'create_account',
    description: 'Create a Koshara account only when the user explicitly requested or confirmed that new account. Do not create accounts automatically while interpreting a statement.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {type: 'string'},
        type: {type: 'string', enum: accountTypes},
        last4: {type: 'string', pattern: '^\\d{4}$'},
        institution: {type: 'string'},
      },
      required: ['name', 'type'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => accountResult(await createAccount({
      name: requiredString(args, 'name'),
      type: parseAccountType(args.type),
      lastFour: optionalString(args, 'last4'),
      institution: optionalString(args, 'institution'),
    })),
  },
  {
    name: 'update_account',
    description: 'Update selected fields on an existing Koshara account. Omitted fields remain unchanged.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {type: 'string'},
        name: {type: 'string'},
        type: {type: 'string', enum: accountTypes},
        last4: {type: 'string'},
        institution: {type: 'string'},
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => {
      const updates: Partial<AccountInput> = {};
      if (typeof args.name === 'string') updates.name = args.name;
      if (args.type !== undefined) updates.type = parseAccountType(args.type);
      if (typeof args.last4 === 'string') updates.lastFour = args.last4;
      if (typeof args.institution === 'string') updates.institution = args.institution;
      return accountResult(await updateAccount(requiredString(args, 'id'), updates));
    },
  },
  {
    name: 'delete_account',
    description: 'Permanently delete an account and all transactions assigned to it. Only call this after the user explicitly requests deletion and understands the returned transaction count will also be removed.',
    inputSchema: {type: 'object', properties: {id: {type: 'string'}}, required: ['id'], additionalProperties: false},
    annotations: mutating,
    execute: async (args) => {
      const result = await deleteAccount(requiredString(args, 'id'));
      return {deletedAccount: accountResult(result.account), deletedTransactionCount: result.deletedTransactionCount};
    },
  },
  {
    name: 'list_categories',
    description: 'Returns all existing Koshara categories, including optional monthlyBudget values in INR. When processing multiple transactions, call this once and use the returned category list to categorize the entire batch. Prefer existing categories and avoid creating new ones unnecessarily; use Uncategorized with needs_review when genuinely uncertain.',
    inputSchema: emptySchema,
    annotations: readOnly,
    execute: () => getKosharaState().categories.map(categoryResult),
  },
  {
    name: 'search_categories',
    description: 'Search existing Koshara categories by name. Returns category IDs and current monthly budgets so an external agent can resolve the correct category without creating duplicates.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {type: 'string', description: 'Case-insensitive text matched against category names.'},
        limit: {type: 'integer', minimum: 1, maximum: 100, default: 50},
      },
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: (args) => {
      const query = optionalString(args, 'query')?.toLocaleLowerCase();
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(Math.trunc(args.limit), 1), 100) : 50;
      const categories = getKosharaState().categories
        .filter((category) => !query || category.name.toLocaleLowerCase().includes(query))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, limit)
        .map(categoryResult);
      return {count: categories.length, categories};
    },
  },
  {
    name: 'create_category',
    description: 'Create a category only with explicit user intent or approval. An optional monthlyBudget sets its monthly spending limit in INR. Prefer existing categories and do not create a category merely because a merchant or statement description is unfamiliar.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {type: 'string'},
        icon: {type: 'string'},
        monthlyBudget: {type: ['number', 'null'], minimum: 0, description: 'Optional monthly spending limit in INR. Use null to leave the category without a limit.'},
      },
      required: ['name'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => categoryResult(await createCategory({
      name: requiredString(args, 'name'),
      icon: optionalString(args, 'icon'),
      budgetMinor: optionalMonthlyBudgetMinor(args),
    })),
  },
  {
    name: 'update_category',
    description: 'Update selected fields on an existing Koshara category. Set monthlyBudget in INR, use null to remove the limit, or omit it to keep the current value. Other omitted fields remain unchanged.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {type: 'string'},
        name: {type: 'string'},
        icon: {type: 'string'},
        monthlyBudget: {type: ['number', 'null'], minimum: 0, description: 'Monthly spending limit in INR. Use null to remove the current limit; omit to keep it unchanged.'},
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => {
      const updates: Partial<CategoryInput> = {};
      if (typeof args.name === 'string') updates.name = args.name;
      if (typeof args.icon === 'string') updates.icon = args.icon;
      const budgetMinor = optionalMonthlyBudgetMinor(args);
      if (budgetMinor !== undefined) updates.budgetMinor = budgetMinor;
      return categoryResult(await updateCategory(requiredString(args, 'id'), updates));
    },
  },
  {
    name: 'delete_category',
    description: 'Delete a category and move its transactions to Uncategorized for review. Uncategorized itself cannot be deleted. Only call this after explicit user confirmation.',
    inputSchema: {type: 'object', properties: {id: {type: 'string'}}, required: ['id'], additionalProperties: false},
    annotations: mutating,
    execute: async (args) => {
      const result = await deleteCategory(requiredString(args, 'id'));
      return {
        deletedCategory: categoryResult(result.category),
        reassignedTransactionCount: result.reassignedTransactionCount,
        fallbackCategoryId: result.fallbackCategoryId,
      };
    },
  },
  {
    name: 'search_transactions',
    description: 'Search Koshara transactions using the same live data shown in the Transactions UI. Use this to inspect existing activity before importing or answering finance questions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {type: 'string', description: 'Matched against description and notes.'},
        accountId: {type: 'string'},
        categoryId: {type: 'string'},
        kind: {type: 'string', enum: ['expense', 'income']},
        reviewStatus: {type: 'string', enum: reviewStatuses},
        from: {type: 'string', description: 'Inclusive YYYY-MM-DD date.'},
        to: {type: 'string', description: 'Inclusive YYYY-MM-DD date.'},
        amount: {type: 'number', exclusiveMinimum: 0, description: 'Exact amount in INR.'},
        limit: {type: 'integer', minimum: 1, maximum: 200, default: 50},
      },
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: (args) => {
      const query = optionalString(args, 'query')?.toLocaleLowerCase();
      const accountId = optionalString(args, 'accountId');
      const categoryId = optionalString(args, 'categoryId');
      const kind = parseKind(args.kind);
      const reviewStatus = parseReviewStatus(args.reviewStatus);
      const from = optionalString(args, 'from');
      const to = optionalString(args, 'to');
      const amountMinor = optionalAmountMinor(args);
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(Math.trunc(args.limit), 1), 200) : 50;
      const transactions = getKosharaState().transactions
        .filter((transaction) => !query || `${transaction.description} ${transaction.notes}`.toLocaleLowerCase().includes(query))
        .filter((transaction) => !accountId || transaction.accountId === accountId)
        .filter((transaction) => !categoryId || transaction.categoryId === categoryId)
        .filter((transaction) => !kind || transaction.kind === kind)
        .filter((transaction) => !reviewStatus || transaction.reviewStatus === reviewStatus)
        .filter((transaction) => !from || transaction.date >= from)
        .filter((transaction) => !to || transaction.date <= to)
        .filter((transaction) => amountMinor === undefined || transaction.amountMinor === amountMinor)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(transactionResult);
      return {count: transactions.length, transactions};
    },
  },
  {
    name: 'get_transaction',
    description: 'Get one Koshara transaction by its exact ID, including review metadata and resolved account/category names.',
    inputSchema: {type: 'object', properties: {id: {type: 'string'}}, required: ['id'], additionalProperties: false},
    annotations: readOnly,
    execute: (args) => {
      const found = getKosharaState().transactions.find((transaction) => transaction.id === requiredString(args, 'id'));
      if (!found) throw new Error('Transaction not found.');
      return transactionResult(found);
    },
  },
  {
    name: 'validate_transaction',
    description: 'Validate one proposed transaction against Koshara business rules without creating it. Checks required values, date, amount, account, category, review status, source, and confidence.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {type: 'string'}, description: {type: 'string'}, amount: {type: 'number'},
        kind: {type: 'string', enum: ['expense', 'income'], default: 'expense'},
        accountId: {type: 'string'}, categoryId: {type: 'string'}, notes: {type: 'string'},
        reviewStatus: {type: 'string', enum: reviewStatuses, default: 'confirmed'},
        source: {type: 'string', enum: sources, default: 'agent'},
        confidence: {type: 'number', minimum: 0, maximum: 1},
      },
      required: ['date', 'description', 'amount', 'accountId', 'categoryId'],
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: (args) => {
      const candidate = transactionInput(args);
      const result = validateTransaction(candidate);
      return {...result, proposedTransaction: proposedTransactionResult(candidate)};
    },
  },
  {
    name: 'check_transactions',
    description: 'Validate and check a batch of proposed Koshara transactions without creating them. Use this for statement imports instead of validating transactions one by one. Checks account/category validity, required fields, review metadata, and possible duplicates. Categorize the batch yourself using one list_categories call; this tool does not infer categories.',
    inputSchema: {
      type: 'object',
      properties: {transactions: {type: 'array', items: proposedTransactionSchema, minItems: 1, maxItems: 200}},
      required: ['transactions'],
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: (args) => {
      const results = transactionBatch(args).map((value, index) => {
        const parsed = parseProposedTransaction(value);
        if (!parsed.candidate) return {index, status: 'invalid', transaction: value, errors: parsed.errors};

        const candidate = parsed.candidate;
        const transaction = proposedTransactionResult(candidate);
        const validation = validateTransaction(candidate);
        if (!validation.valid) return {index, status: 'invalid', transaction, errors: validation.errors};

        const matches = possibleDuplicateMatches(candidate);
        if (matches.length > 0) return {index, status: 'possible_duplicate', transaction, matches};
        if (candidate.reviewStatus === 'needs_review' || candidate.categoryId === 'uncategorized') {
          return {index, status: 'needs_review', transaction, reason: candidate.categoryId === 'uncategorized' ? 'Uncategorized' : 'Marked as needs review'};
        }
        return {index, status: 'ready', transaction};
      });
      return {
        summary: {
          total: results.length,
          ready: results.filter(({status}) => status === 'ready').length,
          possibleDuplicates: results.filter(({status}) => status === 'possible_duplicate').length,
          needsReview: results.filter(({status}) => status === 'needs_review').length,
          invalid: results.filter(({status}) => status === 'invalid').length,
        },
        results,
      };
    },
  },
  {
    name: 'find_possible_duplicates',
    description: 'Check a statement transaction against existing Koshara data before creating it. Returns deterministic likely matches based on the same account, same amount, a date within three days, and similar description. It never skips, deletes, or changes data.',
    inputSchema: {
      type: 'object',
      properties: {date: {type: 'string'}, amount: {type: 'number', exclusiveMinimum: 0}, description: {type: 'string'}, accountId: {type: 'string'}},
      required: ['date', 'amount', 'description', 'accountId'],
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: (args) => {
      const date = requiredString(args, 'date');
      const amountMinor = requiredAmountMinor(args);
      const description = requiredString(args, 'description');
      const accountId = requiredString(args, 'accountId');
      if (!getKosharaState().accounts.some((account) => account.id === accountId)) throw new Error('Account not found.');
      const matches = possibleDuplicateMatches({date, amountMinor, description, accountId});
      return {count: matches.length, possibleDuplicates: matches};
    },
  },
  {
    name: 'create_transaction',
    description: 'Create one transaction in the live Koshara store. Use create_transactions instead for statement imports. Do not silently guess an uncertain account or category: ask the user, or follow their instruction by using a suitable fallback such as Uncategorized and reviewStatus needs_review.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {type: 'string'}, description: {type: 'string'}, amount: {type: 'number', exclusiveMinimum: 0},
        kind: {type: 'string', enum: ['expense', 'income'], default: 'expense'},
        accountId: {type: 'string'}, categoryId: {type: 'string'}, notes: {type: 'string'},
        reviewStatus: {type: 'string', enum: reviewStatuses, default: 'confirmed'},
        source: {type: 'string', enum: sources, default: 'agent'},
        confidence: {type: 'number', minimum: 0, maximum: 1},
      },
      required: ['date', 'description', 'amount', 'accountId', 'categoryId'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => transactionResult(await createTransaction(transactionInput(args))),
  },
  {
    name: 'create_transactions',
    description: 'Create multiple approved Koshara transactions in one call. Prefer this for statement imports after inspecting accounts/categories and, when useful, running check_transactions. Valid rows are created together; invalid rows are reported without blocking the rest. A dry run is optional, not mandatory.',
    inputSchema: {
      type: 'object',
      properties: {transactions: {type: 'array', items: proposedTransactionSchema, minItems: 1, maxItems: 200}},
      required: ['transactions'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => {
      const rows = transactionBatch(args);
      const candidates: Array<{index: number; candidate: TransactionInput}> = [];
      const failed: Array<{index: number; transaction: unknown; errors: Array<{code: string; message: string}>}> = [];

      rows.forEach((value, index) => {
        const parsed = parseProposedTransaction(value);
        if (parsed.candidate) candidates.push({index, candidate: parsed.candidate});
        else failed.push({index, transaction: value, errors: parsed.errors ?? [{code: 'invalid_input', message: 'Transaction is invalid.'}]});
      });

      const batch = candidates.length > 0
        ? await createTransactions(candidates.map(({candidate}) => candidate))
        : {created: [], failed: []};
      const created = batch.created.map(({index, transaction}) => ({
        index: candidates[index]?.index ?? index,
        ...transactionResult(transaction),
      }));
      batch.failed.forEach(({index, errors}) => {
        const row = candidates[index];
        failed.push({index: row?.index ?? index, transaction: row ? proposedTransactionResult(row.candidate) : undefined, errors});
      });
      failed.sort((left, right) => left.index - right.index);

      return {
        summary: {requested: rows.length, created: created.length, failed: failed.length},
        created,
        failed,
      };
    },
  },
  {
    name: 'update_transaction',
    description: 'Update selected fields on an existing transaction. Use reviewStatus confirmed after uncertainty has been resolved; omitted fields remain unchanged.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {type: 'string'}, date: {type: 'string'}, description: {type: 'string'}, amount: {type: 'number', exclusiveMinimum: 0},
        kind: {type: 'string', enum: ['expense', 'income']}, accountId: {type: 'string'}, categoryId: {type: 'string'},
        notes: {type: 'string'}, reviewStatus: {type: 'string', enum: reviewStatuses}, confidence: {type: 'number', minimum: 0, maximum: 1},
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => {
      const updates: Partial<TransactionInput> = {};
      if (typeof args.date === 'string') updates.date = args.date;
      if (typeof args.description === 'string') updates.description = args.description;
      const amountMinor = optionalAmountMinor(args);
      if (amountMinor !== undefined) updates.amountMinor = amountMinor;
      if (args.kind !== undefined) updates.kind = parseKind(args.kind);
      if (typeof args.accountId === 'string') updates.accountId = args.accountId;
      if (typeof args.categoryId === 'string') updates.categoryId = args.categoryId;
      if (typeof args.notes === 'string') updates.notes = args.notes;
      if (args.reviewStatus !== undefined) updates.reviewStatus = parseReviewStatus(args.reviewStatus);
      if (args.confidence !== undefined) updates.confidence = optionalConfidence(args);
      return transactionResult(await updateTransaction(requiredString(args, 'id'), updates));
    },
  },
  {
    name: 'delete_transaction',
    description: 'Permanently delete one transaction. Only call this after the user explicitly asks to delete that exact transaction.',
    inputSchema: {type: 'object', properties: {id: {type: 'string'}}, required: ['id'], additionalProperties: false},
    annotations: mutating,
    execute: async (args) => transactionResult(await deleteTransaction(requiredString(args, 'id'))),
  },
  {
    name: 'get_import_context',
    description: 'Return the accounts, categories, recent transaction reference data, and active staged import in one call. Use this once before preparing a statement so you can reuse existing finance structures and identify possible duplicates.',
    inputSchema: emptySchema,
    annotations: readOnly,
    execute: () => {
      const state = getKosharaState();
      const activeSession = state.importSessions.find(({status}) => status === 'draft' || status === 'ready_for_review');
      return {
        currency: 'INR',
        accounts: state.accounts.map(accountResult),
        categories: state.categories.map(categoryResult),
        recentTransactions: [...state.transactions]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 100)
          .map(transactionResult),
        activeImportSession: activeSession ? importSessionResult(activeSession) : null,
      };
    },
  },
  {
    name: 'create_import_session',
    description: 'Create a temporary statement import workspace. This does not add anything to Transactions. Reuse the returned session ID when staging rows or proposing groups.',
    inputSchema: {
      type: 'object',
      properties: {sourceName: {type: 'string'}, accountId: {type: 'string'}},
      required: ['sourceName'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => importSessionResult(await createStatementImportSession({
      sourceName: requiredString(args, 'sourceName'),
      accountId: optionalString(args, 'accountId'),
    })),
  },
  {
    name: 'stage_transactions',
    description: 'Add a prepared transaction batch to a temporary import session for human review. This never creates live Koshara Transactions; uncertain and duplicate rows are excluded by default.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {type: 'string'},
        transactions: {type: 'array', items: proposedTransactionSchema, minItems: 1, maxItems: 200},
      },
      required: ['sessionId', 'transactions'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => {
      const candidates = transactionBatch(args).map((value, index) => {
        const parsed = parseProposedTransaction(value);
        if (!parsed.candidate) throw new Error(`Transaction ${index + 1} is invalid: ${parsed.errors?.map(({message}) => message).join(' ')}`);
        return parsed.candidate;
      });
      return importSessionResult(await stageImportTransactions(requiredString(args, 'sessionId'), candidates));
    },
  },
  {
    name: 'update_import_item',
    description: 'Adjust one staged row without creating a live transaction. Use it to improve the proposed description, account, category, note, or skip decision. Suspected duplicate overrides remain a human-only action in the Statements review UI.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {type: 'string'},
        itemId: {type: 'string'},
        description: {type: 'string'},
        accountId: {type: 'string'},
        categoryId: {type: 'string'},
        note: {type: 'string'},
        status: {type: 'string', enum: ['skipped']},
      },
      required: ['sessionId', 'itemId'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => {
      const updates: Parameters<typeof updateStatementImportItem>[2] = {};
      if (typeof args.description === 'string') updates.description = args.description;
      if (typeof args.accountId === 'string') updates.proposedAccountId = args.accountId;
      if (typeof args.categoryId === 'string') updates.proposedCategoryId = args.categoryId;
      if (typeof args.note === 'string') updates.note = args.note;
      if (args.status === 'skipped') updates.status = 'skipped';
      return updateStatementImportItem(requiredString(args, 'sessionId'), requiredString(args, 'itemId'), updates);
    },
  },
  {
    name: 'group_import_items',
    description: 'Propose that two or more statement rows represent one logical expense, such as EMI principal, interest, and tax. The group remains a suggestion until the human chooses Merge or Keep separate in Koshara.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {type: 'string'},
        itemIds: {type: 'array', items: {type: 'string'}, minItems: 2},
        label: {type: 'string'},
        description: {type: 'string'},
        categoryId: {type: 'string'},
      },
      required: ['sessionId', 'itemIds', 'label'],
      additionalProperties: false,
    },
    annotations: mutating,
    execute: async (args) => {
      if (!Array.isArray(args.itemIds) || args.itemIds.some((id) => typeof id !== 'string')) throw new Error('itemIds must be an array of strings.');
      return groupStatementImportItems(requiredString(args, 'sessionId'), {
        itemIds: args.itemIds as string[],
        label: requiredString(args, 'label'),
        description: optionalString(args, 'description'),
        categoryId: optionalString(args, 'categoryId'),
      });
    },
  },
  {
    name: 'get_import_session',
    description: 'Return the current staged rows, review statuses, duplicate references, and proposed groups for one import session. This is read-only.',
    inputSchema: {type: 'object', properties: {sessionId: {type: 'string'}}, required: ['sessionId'], additionalProperties: false},
    annotations: readOnly,
    execute: (args) => {
      const session = getKosharaState().importSessions.find(({id}) => id === requiredString(args, 'sessionId'));
      if (!session) throw new Error('Import session not found.');
      return importSessionResult(session);
    },
  },
  {
    name: 'get_spending_summary',
    description: 'Return structured expense and category facts from Koshara for a date range, optionally filtered by account or category. Includes budgets and variance, transaction counts, review and uncategorized totals, six-month category trends, top merchants, recurring payments, and exact possible-duplicate groups. Use these facts for external reasoning; Koshara does not generate AI insights.',
    inputSchema: {
      type: 'object',
      properties: {
        from: {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Inclusive YYYY-MM-DD date. Defaults to the start of the current month.'},
        to: {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Inclusive YYYY-MM-DD date. Defaults to today.'},
        accountId: {type: 'string'},
        categoryId: {type: 'string'},
      },
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: (args) => {
      const defaults = monthBounds();
      const from = optionalString(args, 'from') ?? defaults.from;
      const to = optionalString(args, 'to') ?? defaults.to;
      const accountId = optionalString(args, 'accountId');
      const categoryId = optionalString(args, 'categoryId');
      if (!isValidIsoDate(from) || !isValidIsoDate(to)) throw new Error('from and to must be valid YYYY-MM-DD dates.');
      if (from > to) throw new Error('from must be on or before to.');
      const state = getKosharaState();
      const scopedTransactions = state.transactions
        .filter((transaction) => !accountId || transaction.accountId === accountId)
        .filter((transaction) => !categoryId || transaction.categoryId === categoryId);
      const transactions = scopedTransactions
        .filter((transaction) => transaction.kind === 'expense' && transaction.date >= from && transaction.date <= to)
      const range = {start: from, end: to};
      const analytics = buildCategoryAnalytics(state.categories, scopedTransactions, range);
      const attention = buildAttentionSummary(scopedTransactions, range);
      const duplicateGroups = findPossibleDuplicateGroups(scopedTransactions, range);
      const totals = new Map<string, number>();
      transactions.forEach((transaction) => totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amountMinor));
      return {
        currency: 'INR',
        from,
        to,
        accountId,
        categoryId,
        totalSpend: transactions.reduce((sum, transaction) => sum + transaction.amountMinor, 0) / 100,
        transactionCount: transactions.length,
        totalsByCategory: [...totals.entries()].map(([id, amountMinor]) => ({
          categoryId: id,
          category: state.categories.find((category) => category.id === id)?.name,
          totalSpend: amountMinor / 100,
        })).sort((a, b) => b.totalSpend - a.totalSpend),
        categoryDetails: analytics.rows
          .filter((row) => !categoryId || row.category.id === categoryId)
          .map((row) => ({
            categoryId: row.category.id,
            category: row.category.name,
            monthlyBudget: row.category.budgetMinor === null ? null : row.category.budgetMinor / 100,
            periodBudget: row.budgetLimitMinor === null ? null : row.budgetLimitMinor / 100,
            totalSpend: row.spendingMinor / 100,
            budgetVariance: row.remainingMinor === null ? null : row.remainingMinor / 100,
            budgetUsagePercent: row.budgetStatus?.percent ?? null,
            budgetStatus: row.budgetStatus?.label ?? null,
            transactionCount: row.transactionCount,
            averageTransaction: row.averageMinor / 100,
            previousPeriodSpend: row.previousSpendingMinor / 100,
            change: row.change,
            monthlyTrend: row.trend.map((point) => ({month: point.month, totalSpend: point.amountMinor / 100})),
            topMerchants: row.topMerchants.map((merchant) => ({
              merchant: merchant.merchant,
              totalSpend: merchant.amountMinor / 100,
              transactionCount: merchant.transactionCount,
            })),
            recurringPayments: row.recurringPayments,
          })),
        attention: {
          needsReview: {count: attention.needsReview.count, amount: attention.needsReview.amountMinor / 100, transactionIds: attention.needsReview.transactionIds},
          uncategorized: {count: attention.uncategorized.count, amount: attention.uncategorized.amountMinor / 100, transactionIds: attention.uncategorized.transactionIds},
          combined: {count: attention.combined.count, amount: attention.combined.amountMinor / 100, transactionIds: attention.combined.transactionIds},
        },
        possibleDuplicateGroups: duplicateGroups.map((group) => ({
          description: group.description,
          date: group.date,
          accountId: group.accountId,
          amount: group.amountMinor / 100,
          transactionIds: group.transactionIds,
        })),
      };
    },
  },
  {
    name: 'configure_cashflow_chart',
    description: 'Update the currently visible Dashboard cash-flow chart after analyzing Koshara data with read-only finance tools. This changes temporary presentation state only and never changes transactions, accounts, categories, or budgets. Use an insightTitle to summarize the finding, comparison to show change over time, and highlights to identify responsible dates or categories.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {type: 'string', enum: cashflowChartModes, description: 'Visible cash-flow series.'},
        grouping: {type: 'string', enum: timelineGroupings, description: 'Time bucket size.'},
        dateRange: {
          type: 'object',
          properties: {
            from: {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Inclusive start date.'},
            to: {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Inclusive end date.'},
          },
          required: ['from', 'to'],
          additionalProperties: false,
        },
        accountIds: {type: 'array', items: {type: 'string'}, uniqueItems: true, description: 'Existing account IDs to include. Empty or omitted includes every account.'},
        categoryIds: {type: 'array', items: {type: 'string'}, uniqueItems: true, description: 'Existing category IDs to include. Empty or omitted includes every category.'},
        comparePreviousPeriod: {type: 'boolean', description: 'Overlay the immediately preceding period of equal duration.'},
        highlightedDates: {type: 'array', items: {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$'}, uniqueItems: true, description: 'Dates to emphasize on the chart.'},
        highlightedCategoryIds: {type: 'array', items: {type: 'string'}, uniqueItems: true, description: 'Existing category IDs to emphasize as drivers.'},
        insightTitle: {type: 'string', minLength: 1, maxLength: 120, description: 'Short agent-generated title explaining the chart insight.'},
      },
      additionalProperties: false,
    },
    annotations: mutating,
    execute: (args) => {
      const next = configureCashflowChart(parseCashflowChartConfiguration(args));
      return {updated: true, configuration: next, message: 'The visible Dashboard cash-flow chart was updated. Financial data was not changed.'};
    },
  },
  {
    name: 'configure_category_spending_chart',
    description: 'Update the currently visible Dashboard spending-by-category pie chart after analyzing Koshara data with read-only finance tools. This changes temporary presentation state only and never changes transactions, categories, or budgets.',
    inputSchema: {
      type: 'object',
      properties: {
        dateRange: {
          type: 'object',
          properties: {
            from: {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Inclusive start date.'},
            to: {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Inclusive end date.'},
          },
          required: ['from', 'to'],
          additionalProperties: false,
        },
        accountIds: {type: 'array', items: {type: 'string'}, uniqueItems: true, description: 'Existing account IDs to include. Empty or omitted includes every account.'},
        categoryIds: {type: 'array', items: {type: 'string'}, uniqueItems: true, description: 'Existing category IDs to include. Empty or omitted includes every spending category.'},
        highlightedCategoryIds: {type: 'array', items: {type: 'string'}, uniqueItems: true, description: 'Existing category IDs to emphasize in the pie chart.'},
        insightTitle: {type: 'string', minLength: 1, maxLength: 120, description: 'Short agent-generated title explaining the category insight.'},
      },
      additionalProperties: false,
    },
    annotations: mutating,
    execute: (args) => {
      const next = configureCategorySpendingChart(parseCategorySpendingChartConfiguration(args));
      return {updated: true, configuration: next, message: 'The visible Dashboard category-spending chart was updated. Financial data was not changed.'};
    },
  },
];

export interface WebMCPPageContext {
  label: string;
  groups: Array<{label: string; names: string[]}>;
  tools: WebMCPTool[];
}

const pageContexts: Array<{matches: (pathname: string) => boolean; label: string; groups: Array<{label: string; names: string[]}>}> = [
  {
    matches: (pathname) => pathname === '/dashboard',
    label: 'Dashboard',
    groups: [
      {label: 'Dashboard insights', names: ['get_spending_summary', 'search_transactions', 'get_accounts', 'list_categories']},
      {label: 'Chart presentation', names: ['configure_cashflow_chart', 'configure_category_spending_chart']},
    ],
  },
  {
    matches: (pathname) => pathname === '/transactions' || pathname.startsWith('/transactions/'),
    label: 'Transactions',
    groups: [{label: 'Transactions', names: ['search_transactions', 'get_transaction', 'create_transaction', 'update_transaction', 'delete_transaction']}],
  },
  {
    matches: (pathname) => pathname === '/accounts' || pathname.startsWith('/accounts/'),
    label: 'Accounts',
    groups: [{label: 'Accounts', names: ['get_accounts', 'create_account', 'update_account', 'delete_account']}],
  },
  {
    matches: (pathname) => pathname === '/categories' || pathname.startsWith('/categories/'),
    label: 'Categories',
    groups: [{label: 'Categories', names: ['search_categories', 'list_categories', 'create_category', 'update_category', 'delete_category']}],
  },
  {
    matches: (pathname) => pathname === '/statements' || pathname.startsWith('/statements/'),
    label: 'Statements',
    groups: [
      {label: 'Statement context', names: ['get_import_context', 'check_transactions']},
      {label: 'Staged review', names: ['create_import_session', 'stage_transactions', 'update_import_item', 'group_import_items', 'get_import_session']},
    ],
  },
];

export function getWebMCPPageContext(pathname: string): WebMCPPageContext | null {
  const context = pageContexts.find(({matches}) => matches(pathname));
  if (!context) return null;
  const names = new Set(context.groups.flatMap((group) => group.names));
  return {
    label: context.label,
    groups: context.groups,
    tools: KOSHARA_WEBMCP_TOOLS.filter(({name}) => names.has(name)),
  };
}
