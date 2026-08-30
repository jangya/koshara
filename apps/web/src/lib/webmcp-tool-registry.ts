import {
  createAccount,
  createCategory,
  createTransaction,
  createTransactions,
  deleteAccount,
  deleteCategory,
  deleteTransaction,
  getKosharaState,
  updateAccount,
  updateCategory,
  updateTransaction,
  validateTransaction,
} from './koshara-store';
import type {
  Account,
  AccountInput,
  AccountType,
  Category,
  CategoryInput,
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
] as const;

const emptySchema = {type: 'object', properties: {}, additionalProperties: false};
const readOnly = {readOnlyHint: true};
const mutating = {readOnlyHint: false};
const accountTypes: AccountType[] = ['bank', 'credit-card', 'cash', 'wallet', 'other'];
const reviewStatuses: ReviewStatus[] = ['confirmed', 'needs_review'];
const sources: TransactionSource[] = ['manual', 'agent'];
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
    name: 'get_spending_summary',
    description: 'Return structured expense totals from Koshara for a date range, optionally filtered by account or category. Use this data for external reasoning; Koshara does not generate AI insights.',
    inputSchema: {
      type: 'object',
      properties: {from: {type: 'string'}, to: {type: 'string'}, accountId: {type: 'string'}, categoryId: {type: 'string'}},
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: (args) => {
      const defaults = monthBounds();
      const from = optionalString(args, 'from') ?? defaults.from;
      const to = optionalString(args, 'to') ?? defaults.to;
      const accountId = optionalString(args, 'accountId');
      const categoryId = optionalString(args, 'categoryId');
      const transactions = getKosharaState().transactions
        .filter((transaction) => transaction.kind === 'expense' && transaction.date >= from && transaction.date <= to)
        .filter((transaction) => !accountId || transaction.accountId === accountId)
        .filter((transaction) => !categoryId || transaction.categoryId === categoryId);
      const totals = new Map<string, number>();
      transactions.forEach((transaction) => totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amountMinor));
      const state = getKosharaState();
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
      };
    },
  },
];
