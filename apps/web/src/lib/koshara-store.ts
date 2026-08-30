'use client';

import {useSyncExternalStore} from 'react';

import {createDemoState, demoCategories} from './koshara-seed';
import {validateCategoryInput as validateCategoryRules} from './category-rules';
import type {
  Account,
  AccountInput,
  AccountType,
  Category,
  CategoryColor,
  CategoryInput,
  ImportGroup,
  ImportGroupResolution,
  ImportItem,
  ImportSession,
  KosharaState,
  ReviewStatus,
  Transaction,
  TransactionInput,
  TransactionSource,
  TransactionValidationResult,
} from './koshara-types';

const STORAGE_KEY = 'koshara.finance.v1';
export const SIMULATED_WRITE_DELAY_MS = 700;
const serverSnapshot = createDemoState();
let snapshot = serverSnapshot;
let isHydrated = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener());
}

function persist() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }
}

function commit(next: KosharaState) {
  snapshot = next;
  persist();
  emit();
}

function simulateWriteDelay() {
  return new Promise<void>((resolve) => setTimeout(resolve, SIMULATED_WRITE_DELAY_MS));
}

const accountTypes: AccountType[] = ['bank', 'credit-card', 'cash', 'wallet', 'other'];
const reviewStatuses: ReviewStatus[] = ['confirmed', 'needs_review'];
const transactionSources: TransactionSource[] = ['demo', 'manual', 'agent'];
const accountColors: Account['color'][] = ['blue', 'green', 'orange'];
const categoryColors: CategoryColor[] = ['green', 'orange', 'blue', 'purple', 'teal', 'pink', 'cyan', 'red', 'yellow'];

function createId(prefix: string) {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function importApprovalSelection(session: ImportSession) {
  const mergedGroups = session.groups.filter((group) => group.resolution === 'merged');
  const groupedItemIds = new Set(session.groups
    .filter((group) => group.resolution !== 'separate')
    .flatMap((group) => group.itemIds));
  const standaloneItems = session.items
    .filter((item) => item.included && item.status === 'ready' && !groupedItemIds.has(item.id));
  const approvedItemIds = new Set([
    ...standaloneItems.map(({id}) => id),
    ...mergedGroups.flatMap(({itemIds}) => itemIds),
  ]);
  return {mergedGroups, standaloneItems, approvedItemIds};
}

function sessionAfterApproval(session: ImportSession, approvedTransactionIds: string[]): ImportSession {
  const {approvedItemIds} = importApprovalSelection(session);
  const separateGroupIds = new Set(session.groups
    .filter(({resolution}) => resolution === 'separate')
    .map(({id}) => id));
  const remainingItems = session.items
    .filter(({id}) => !approvedItemIds.has(id))
    .map((item) => item.groupId && separateGroupIds.has(item.groupId) ? {...item, groupId: undefined} : item);
  const remainingItemIds = new Set(remainingItems.map(({id}) => id));
  const remainingGroups = session.groups.flatMap((group) => {
    if (group.resolution !== 'proposed') return [];
    const itemIds = group.itemIds.filter((id) => remainingItemIds.has(id));
    return itemIds.length >= 2 ? [{...group, itemIds}] : [];
  });
  const hasPendingReview = remainingItems.some(({status}) => status !== 'skipped');

  return hasPendingReview
    ? {
        ...session,
        status: 'ready_for_review',
        items: remainingItems,
        groups: remainingGroups,
        approvedTransactionIds,
      }
    : {...session, status: 'imported', approvedTransactionIds};
}

function normalizeState(value: KosharaState): KosharaState {
  const categories = [...value.categories];
  const importSessions = Array.isArray(value.importSessions) ? value.importSessions : [];
  demoCategories.forEach((seeded) => {
    if (!categories.some((category) => category.id === seeded.id)) categories.push({...seeded});
  });
  return {
    accounts: value.accounts.map((account, index) => ({
      ...account,
      institution: account.institution?.trim() || undefined,
      lastFour: account.lastFour?.trim() || undefined,
      balanceMinor: Number.isFinite(account.balanceMinor) ? account.balanceMinor : 0,
      color: account.color ?? accountColors[index % accountColors.length],
    })),
    categories: categories.map((category, index) => ({
      ...category,
      budgetMinor: category.budgetMinor ?? null,
      color: category.color ?? categoryColors[index % categoryColors.length],
    })),
    transactions: value.transactions.map((transaction) => {
      const legacy = transaction as unknown as {note?: string; source?: string};
      return {
        ...transaction,
        notes: transaction.notes ?? legacy.note ?? '',
        reviewStatus: transaction.reviewStatus ?? 'confirmed',
        source: legacy.source === 'webmcp' ? 'agent' : transactionSources.includes(legacy.source as TransactionSource) ? legacy.source as TransactionSource : 'manual',
      };
    }),
    importSessions: importSessions.map((session) => {
      const normalized: ImportSession = {
        ...session,
        items: Array.isArray(session.items) ? session.items.map((item) => ({
          ...item,
          duplicateTransactionIds: Array.isArray(item.duplicateTransactionIds) ? item.duplicateTransactionIds : [],
          duplicateApproved: item.duplicateApproved ?? false,
          sourceReferences: Array.isArray(item.sourceReferences) ? item.sourceReferences : [],
        })) : [],
        groups: Array.isArray(session.groups) ? session.groups : [],
        approvedTransactionIds: Array.isArray(session.approvedTransactionIds) ? session.approvedTransactionIds : [],
      };
      if (normalized.status !== 'imported' || normalized.approvedTransactionIds.length === 0) return normalized;
      const recovered = sessionAfterApproval(normalized, normalized.approvedTransactionIds);
      return recovered.status === 'ready_for_review' ? recovered : normalized;
    }),
  };
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateTransaction(input: TransactionInput): TransactionValidationResult {
  const errors: TransactionValidationResult['errors'] = [];
  if (!input.description?.trim()) errors.push({field: 'description', code: 'required', message: 'Description is required.'});
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) errors.push({field: 'amountMinor', code: 'invalid_amount', message: 'Amount must be greater than zero.'});
  if (!isValidDate(input.date)) errors.push({field: 'date', code: 'invalid_date', message: 'Date must be a real date in YYYY-MM-DD format.'});
  if (!snapshot.accounts.some((account) => account.id === input.accountId)) errors.push({field: 'accountId', code: 'not_found', message: 'Account not found.'});
  if (!snapshot.categories.some((category) => category.id === input.categoryId)) errors.push({field: 'categoryId', code: 'not_found', message: 'Category not found.'});
  if (input.kind !== 'expense' && input.kind !== 'income') errors.push({field: 'kind', code: 'invalid_kind', message: 'Type must be expense or income.'});
  if (input.reviewStatus && !reviewStatuses.includes(input.reviewStatus)) errors.push({field: 'reviewStatus', code: 'invalid_review_status', message: 'Review status must be confirmed or needs_review.'});
  if (input.source && !transactionSources.includes(input.source)) errors.push({field: 'source', code: 'invalid_source', message: 'Source must be demo, manual, or agent.'});
  if (input.confidence !== undefined && (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1)) {
    errors.push({field: 'confidence', code: 'invalid_confidence', message: 'Confidence must be between 0 and 1.'});
  }
  return {valid: errors.length === 0, errors};
}

function assertValidTransaction(input: TransactionInput) {
  const validation = validateTransaction(input);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join(' '));
}

function validateAccountInput(input: AccountInput, currentId?: string) {
  if (!input.name.trim()) throw new Error('Account name is required.');
  if (!accountTypes.includes(input.type)) throw new Error('Account type is invalid.');
  if (input.lastFour?.trim() && !/^\d{4}$/.test(input.lastFour.trim())) throw new Error('Last four must contain exactly four digits.');
  const duplicate = snapshot.accounts.some((account) => account.id !== currentId && account.name.toLocaleLowerCase() === input.name.trim().toLocaleLowerCase());
  if (duplicate) throw new Error('An account with this name already exists.');
}

function validateCategoryInput(input: CategoryInput, currentId?: string) {
  const validation = validateCategoryRules(input, snapshot.categories, currentId);
  const error = validation.errors.name ?? validation.errors.budgetMinor;
  if (error) throw new Error(error);
  if (input.color && !categoryColors.includes(input.color)) throw new Error('Category color is invalid.');
}

export function hydrateKosharaStore() {
  if (isHydrated || typeof window === 'undefined') return;
  isHydrated = true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as KosharaState;
      if (Array.isArray(parsed.accounts) && Array.isArray(parsed.categories) && Array.isArray(parsed.transactions)) {
        snapshot = normalizeState(parsed);
        persist();
        emit();
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      snapshot = normalizeState(JSON.parse(event.newValue) as KosharaState);
      emit();
    } catch {
      // Ignore malformed changes from another tab.
    }
  });
}

export function useKosharaState() {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
}

export function getKosharaState() {
  return snapshot;
}

function buildTransaction(input: TransactionInput, createdAt: string): Transaction {
  return {
    ...input,
    id: createId('tx'),
    description: input.description.trim(),
    notes: input.notes?.trim() ?? '',
    reviewStatus: input.reviewStatus ?? 'confirmed',
    source: input.source ?? 'manual',
    createdAt,
  };
}

export async function createTransactions(inputs: TransactionInput[]) {
  await simulateWriteDelay();
  const validations = inputs.map((input) => validateTransaction(input));
  const createdAt = new Date().toISOString();
  const created = inputs.flatMap((input, index) => validations[index]?.valid
    ? [{index, transaction: buildTransaction(input, createdAt)}]
    : []);
  const failed = validations.flatMap((validation, index) => validation.valid
    ? []
    : [{index, errors: validation.errors}]);

  if (created.length > 0) {
    commit({...snapshot, transactions: [...created.map(({transaction}) => transaction), ...snapshot.transactions]});
  }

  return {created, failed};
}

export async function createTransaction(input: TransactionInput) {
  const result = await createTransactions([input]);
  const created = result.created[0]?.transaction;
  if (!created) throw new Error(result.failed[0]?.errors.map((issue) => issue.message).join(' ') || 'Transaction could not be created.');
  return created;
}

export async function updateTransaction(id: string, updates: Partial<TransactionInput>) {
  await simulateWriteDelay();
  const current = snapshot.transactions.find((transaction) => transaction.id === id);
  if (!current) throw new Error('Transaction not found.');
  const next: Transaction = {...current, ...updates};
  assertValidTransaction(next);
  commit({...snapshot, transactions: snapshot.transactions.map((transaction) => transaction.id === id ? next : transaction)});
  return next;
}

export async function updateTransactions(ids: string[], updates: Pick<Partial<TransactionInput>, 'categoryId' | 'reviewStatus'>) {
  await simulateWriteDelay();
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) throw new Error('Select at least one transaction.');
  const selected = uniqueIds.map((id) => snapshot.transactions.find((transaction) => transaction.id === id));
  if (selected.some((transaction) => !transaction)) throw new Error('One or more selected transactions were not found.');
  const updated = selected.map((transaction) => ({...transaction!, ...updates}));
  updated.forEach(assertValidTransaction);
  const byId = new Map(updated.map((transaction) => [transaction.id, transaction]));
  commit({
    ...snapshot,
    transactions: snapshot.transactions.map((transaction) => byId.get(transaction.id) ?? transaction),
  });
  return updated;
}

export async function createAccount(input: AccountInput) {
  await simulateWriteDelay();
  validateAccountInput(input);
  const created: Account = {
    id: createId('account'),
    name: input.name.trim(),
    type: input.type,
    lastFour: input.lastFour?.trim() || undefined,
    institution: input.institution?.trim() || undefined,
    balanceMinor: 0,
    color: accountColors[snapshot.accounts.length % accountColors.length] ?? 'blue',
  };
  commit({...snapshot, accounts: [...snapshot.accounts, created]});
  return created;
}

export async function updateAccount(id: string, updates: Partial<AccountInput>) {
  await simulateWriteDelay();
  const current = snapshot.accounts.find((account) => account.id === id);
  if (!current) throw new Error('Account not found.');
  const nextInput: AccountInput = {
    name: updates.name ?? current.name,
    type: updates.type ?? current.type,
    lastFour: updates.lastFour ?? current.lastFour,
    institution: updates.institution ?? current.institution,
  };
  validateAccountInput(nextInput, id);
  const next: Account = {
    ...current,
    ...nextInput,
    name: nextInput.name.trim(),
    lastFour: nextInput.lastFour?.trim() || undefined,
    institution: nextInput.institution?.trim() || undefined,
  };
  commit({...snapshot, accounts: snapshot.accounts.map((account) => account.id === id ? next : account)});
  return next;
}

export async function createCategory(input: CategoryInput) {
  await simulateWriteDelay();
  validateCategoryInput(input);
  const created: Category = {
    id: createId('category'),
    name: input.name.trim(),
    icon: input.icon?.trim() || undefined,
    budgetMinor: input.budgetMinor ?? null,
    color: input.color ?? categoryColors[snapshot.categories.length % categoryColors.length] ?? 'purple',
  };
  commit({...snapshot, categories: [...snapshot.categories, created]});
  return created;
}

export async function updateCategory(id: string, updates: Partial<CategoryInput>) {
  await simulateWriteDelay();
  const current = snapshot.categories.find((category) => category.id === id);
  if (!current) throw new Error('Category not found.');
  const nextInput: CategoryInput = {
    name: updates.name ?? current.name,
    icon: updates.icon ?? current.icon,
    budgetMinor: updates.budgetMinor !== undefined ? updates.budgetMinor : current.budgetMinor,
    color: updates.color ?? current.color,
  };
  validateCategoryInput(nextInput, id);
  const next: Category = {
    ...current,
    name: nextInput.name.trim(),
    icon: nextInput.icon?.trim() || undefined,
    budgetMinor: nextInput.budgetMinor ?? null,
    color: nextInput.color ?? current.color,
  };
  commit({...snapshot, categories: snapshot.categories.map((category) => category.id === id ? next : category)});
  return next;
}

export async function deleteTransaction(id: string) {
  await simulateWriteDelay();
  const current = snapshot.transactions.find((transaction) => transaction.id === id);
  if (!current) throw new Error('Transaction not found.');
  commit({...snapshot, transactions: snapshot.transactions.filter((transaction) => transaction.id !== id)});
  return current;
}

export async function deleteAccount(id: string) {
  await simulateWriteDelay();
  const account = snapshot.accounts.find((candidate) => candidate.id === id);
  if (!account) throw new Error('Account not found.');
  const deletedTransactionCount = snapshot.transactions.filter((transaction) => transaction.accountId === id).length;
  commit({
    ...snapshot,
    accounts: snapshot.accounts.filter((candidate) => candidate.id !== id),
    transactions: snapshot.transactions.filter((transaction) => transaction.accountId !== id),
  });
  return {account, deletedTransactionCount};
}

export async function deleteCategory(id: string) {
  await simulateWriteDelay();
  const category = snapshot.categories.find((candidate) => candidate.id === id);
  if (!category) throw new Error('Category not found.');
  if (id === 'uncategorized') throw new Error('Uncategorized is required as the fallback category.');
  const fallback = snapshot.categories.find((candidate) => candidate.id === 'uncategorized');
  if (!fallback) throw new Error('Uncategorized fallback is missing.');
  const reassignedTransactionCount = snapshot.transactions.filter((transaction) => transaction.categoryId === id).length;
  commit({
    ...snapshot,
    categories: snapshot.categories.filter((candidate) => candidate.id !== id),
    transactions: snapshot.transactions.map((transaction) => transaction.categoryId === id
      ? {...transaction, categoryId: fallback.id, reviewStatus: 'needs_review'}
      : transaction),
  });
  return {category, reassignedTransactionCount, fallbackCategoryId: fallback.id};
}

function normalizedDescription(value: string) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function descriptionsAreSimilar(left: string, right: string) {
  const a = normalizedDescription(left);
  const b = normalizedDescription(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aWords = new Set(a.split(' ').filter((word) => word.length > 2));
  const bWords = new Set(b.split(' ').filter((word) => word.length > 2));
  const shared = [...aWords].filter((word) => bWords.has(word)).length;
  return shared > 0 && shared / Math.max(aWords.size, bWords.size) >= 0.5;
}

function possibleDuplicateIds(candidate: Pick<TransactionInput, 'date' | 'description' | 'amountMinor' | 'accountId'>) {
  return snapshot.transactions.flatMap((transaction) => {
    const daysApart = Math.abs(new Date(`${transaction.date}T00:00:00Z`).getTime() - new Date(`${candidate.date}T00:00:00Z`).getTime()) / 86_400_000;
    return transaction.accountId === candidate.accountId
      && transaction.amountMinor === candidate.amountMinor
      && daysApart <= 3
      && descriptionsAreSimilar(transaction.description, candidate.description)
      ? [transaction.id]
      : [];
  });
}

function getImportSessionOrThrow(id: string) {
  const session = snapshot.importSessions.find((candidate) => candidate.id === id);
  if (!session) throw new Error('Import session not found.');
  return session;
}

function replaceImportSession(next: ImportSession) {
  commit({
    ...snapshot,
    importSessions: snapshot.importSessions.map((session) => session.id === next.id ? next : session),
  });
}

function importItemInput(item: ImportItem): TransactionInput {
  return {
    date: item.date,
    description: item.description,
    amountMinor: item.amountMinor,
    kind: item.kind,
    accountId: item.proposedAccountId,
    categoryId: item.proposedCategoryId,
    notes: item.note,
    reviewStatus: item.proposedCategoryId === 'uncategorized' ? 'needs_review' : 'confirmed',
    source: 'agent',
    confidence: item.confidence,
  };
}

function deriveImportItem(item: ImportItem, options?: {restore?: boolean; duplicateOverride?: boolean}) {
  if (item.status === 'skipped' && !options?.restore) return {...item, included: false};
  const duplicateOverride = options?.duplicateOverride ?? item.duplicateApproved;
  if (item.duplicateTransactionIds.length > 0 && !duplicateOverride) {
    return {...item, duplicateApproved: false, status: 'possible_duplicate' as const, included: false};
  }
  const validation = validateTransaction(importItemInput(item));
  if (!validation.valid || item.proposedCategoryId === 'uncategorized') {
    return {
      ...item,
      status: 'needs_attention' as const,
      included: false,
      note: validation.valid ? item.note : validation.errors.map(({message}) => message).join(' '),
    };
  }
  return {...item, duplicateApproved: duplicateOverride, status: 'ready' as const, included: true};
}

export async function createStatementImportSession(input: {sourceName: string; accountId?: string}) {
  await simulateWriteDelay();
  if (!input.sourceName.trim()) throw new Error('Source name is required.');
  if (input.accountId && !snapshot.accounts.some((account) => account.id === input.accountId)) throw new Error('Account not found.');
  const activeSession = snapshot.importSessions.find(({status}) => status === 'draft' || status === 'ready_for_review');
  if (activeSession) return activeSession;
  const session: ImportSession = {
    id: createId('import'),
    createdAt: new Date().toISOString(),
    sourceName: input.sourceName.trim(),
    accountId: input.accountId,
    status: 'draft',
    items: [],
    groups: [],
    approvedTransactionIds: [],
  };
  commit({...snapshot, importSessions: [session, ...snapshot.importSessions]});
  return session;
}

export async function stageImportTransactions(sessionId: string, inputs: TransactionInput[]) {
  await simulateWriteDelay();
  const session = getImportSessionOrThrow(sessionId);
  if (session.status === 'imported' || session.status === 'cancelled') throw new Error('This import session can no longer be changed.');
  if (inputs.length === 0) throw new Error('Add at least one proposed transaction.');

  const items = inputs.map((input): ImportItem => {
    const duplicateTransactionIds = possibleDuplicateIds(input);
    const initial: ImportItem = {
      id: createId('import-item'),
      importSessionId: session.id,
      date: input.date,
      description: input.description.trim(),
      amountMinor: input.amountMinor,
      kind: input.kind,
      proposedAccountId: input.accountId,
      proposedCategoryId: input.categoryId,
      status: 'ready',
      included: true,
      note: input.notes?.trim() ?? '',
      confidence: input.confidence,
      duplicateTransactionIds,
      duplicateApproved: false,
      sourceReferences: [],
    };
    if (input.reviewStatus === 'needs_review') return {...initial, status: 'needs_attention', included: false};
    return deriveImportItem(initial);
  });
  const next = {...session, status: 'ready_for_review' as const, items: [...session.items, ...items]};
  replaceImportSession(next);
  return next;
}

export async function updateStatementImportItem(sessionId: string, itemId: string, updates: Partial<Pick<ImportItem, 'description' | 'proposedAccountId' | 'proposedCategoryId' | 'note' | 'status'>> & {includeDuplicate?: boolean}) {
  await simulateWriteDelay();
  const session = getImportSessionOrThrow(sessionId);
  if (session.status !== 'ready_for_review') throw new Error('This import session is not open for review.');
  const current = session.items.find((item) => item.id === itemId);
  if (!current) throw new Error('Import item not found.');
  const {includeDuplicate, ...itemUpdates} = updates;
  const edited = {...current, ...itemUpdates};
  const nextItem = itemUpdates.status === 'skipped'
    ? {...edited, status: 'skipped' as const, included: false}
    : deriveImportItem(edited, {restore: current.status === 'skipped', duplicateOverride: includeDuplicate});
  const next = {...session, items: session.items.map((item) => item.id === itemId ? nextItem : item)};
  replaceImportSession(next);
  return nextItem;
}

export async function groupStatementImportItems(sessionId: string, input: {itemIds: string[]; label: string; description?: string; categoryId?: string}) {
  await simulateWriteDelay();
  const session = getImportSessionOrThrow(sessionId);
  if (session.status !== 'ready_for_review') throw new Error('This import session is not open for review.');
  const itemIds = [...new Set(input.itemIds)];
  const items = itemIds.map((id) => session.items.find((item) => item.id === id));
  if (items.length < 2 || items.some((item) => !item)) throw new Error('Choose at least two valid import items to group.');
  const resolvedItems = items as ImportItem[];
  if (resolvedItems.some((item) => item.groupId)) throw new Error('One or more import items already belong to a proposed group.');
  const group: ImportGroup = {
    id: createId('import-group'),
    label: input.label.trim() || 'Suggested group',
    itemIds,
    proposedDescription: input.description?.trim() || input.label.trim() || resolvedItems[0]!.description,
    proposedAmountMinor: resolvedItems.reduce((sum, item) => sum + item.amountMinor, 0),
    proposedAccountId: resolvedItems[0]!.proposedAccountId,
    proposedCategoryId: input.categoryId || resolvedItems[0]!.proposedCategoryId,
    resolution: 'proposed',
  };
  const next = {
    ...session,
    groups: [...session.groups, group],
    items: session.items.map((item) => itemIds.includes(item.id) ? {...item, groupId: group.id, included: false} : item),
  };
  replaceImportSession(next);
  return group;
}

export async function resolveStatementImportGroup(sessionId: string, groupId: string, resolution: Exclude<ImportGroupResolution, 'proposed'>) {
  await simulateWriteDelay();
  const session = getImportSessionOrThrow(sessionId);
  if (session.status !== 'ready_for_review') throw new Error('This import session is not open for review.');
  const group = session.groups.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error('Import group not found.');
  const next = {
    ...session,
    groups: session.groups.map((candidate) => candidate.id === groupId ? {...candidate, resolution} : candidate),
    items: session.items.map((item) => group.itemIds.includes(item.id)
      ? {...item, included: resolution === 'separate' && item.status === 'ready'}
      : item),
  };
  replaceImportSession(next);
  return next.groups.find((candidate) => candidate.id === groupId)!;
}

export async function approveStatementImport(sessionId: string) {
  await simulateWriteDelay();
  const session = getImportSessionOrThrow(sessionId);
  if (session.status !== 'ready_for_review') throw new Error('This import session is not ready for approval.');
  const {mergedGroups, standaloneItems} = importApprovalSelection(session);
  const itemInputs = standaloneItems.map(importItemInput);
  const groupInputs: TransactionInput[] = mergedGroups.map((group) => ({
    date: session.items.find((item) => group.itemIds.includes(item.id))?.date ?? new Date().toISOString().slice(0, 10),
    description: group.proposedDescription,
    amountMinor: group.proposedAmountMinor,
    kind: 'expense',
    accountId: group.proposedAccountId,
    categoryId: group.proposedCategoryId,
    notes: `Merged from ${group.itemIds.length} statement rows`,
    reviewStatus: 'confirmed',
    source: 'agent',
  }));
  const inputs = [...groupInputs, ...itemInputs];
  inputs.forEach(assertValidTransaction);
  const createdAt = new Date().toISOString();
  const created = inputs.map((input) => buildTransaction(input, createdAt));
  const nextSession = sessionAfterApproval(session, [
    ...session.approvedTransactionIds,
    ...created.map(({id}) => id),
  ]);
  commit({
    ...snapshot,
    transactions: [...created, ...snapshot.transactions],
    importSessions: snapshot.importSessions.map((candidate) => candidate.id === session.id ? nextSession : candidate),
  });
  return {session: nextSession, transactions: created};
}
