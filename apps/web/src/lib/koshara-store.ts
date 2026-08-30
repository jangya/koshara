'use client';

import {useSyncExternalStore} from 'react';

import {createDemoState, demoCategories} from './koshara-seed';
import type {
  Account,
  AccountInput,
  AccountType,
  Category,
  CategoryColor,
  CategoryInput,
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

function normalizeState(value: KosharaState): KosharaState {
  const categories = [...value.categories];
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
  if (!input.name.trim()) throw new Error('Category name is required.');
  const duplicate = snapshot.categories.some((category) => category.id !== currentId && category.name.toLocaleLowerCase() === input.name.trim().toLocaleLowerCase());
  if (duplicate) throw new Error('A category with this name already exists.');
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
    budgetMinor: null,
    color: categoryColors[snapshot.categories.length % categoryColors.length] ?? 'purple',
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
  };
  validateCategoryInput(nextInput, id);
  const next: Category = {
    ...current,
    name: nextInput.name.trim(),
    icon: nextInput.icon?.trim() || undefined,
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
