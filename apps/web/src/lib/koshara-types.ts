export type AccountType = 'bank' | 'credit-card' | 'cash' | 'wallet' | 'other';
export type TransactionKind = 'expense' | 'income';
export type ReviewStatus = 'confirmed' | 'needs_review';
export type TransactionSource = 'demo' | 'manual' | 'agent';
export type CategoryColor = 'blue' | 'cyan' | 'green' | 'orange' | 'pink' | 'purple' | 'red' | 'teal' | 'yellow';
export type ImportSessionStatus = 'draft' | 'ready_for_review' | 'imported' | 'cancelled';
export type ImportItemStatus = 'ready' | 'needs_attention' | 'possible_duplicate' | 'skipped';
export type ImportGroupResolution = 'proposed' | 'merged' | 'separate';

export interface Account {
  id: string;
  name: string;
  institution?: string;
  type: AccountType;
  lastFour?: string;
  balanceMinor: number;
  color: 'blue' | 'green' | 'orange';
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  budgetMinor: number | null;
  color: CategoryColor;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amountMinor: number;
  kind: TransactionKind;
  accountId: string;
  categoryId: string;
  notes: string;
  reviewStatus: ReviewStatus;
  source: TransactionSource;
  confidence?: number;
  createdAt: string;
}

export interface ImportItem {
  id: string;
  importSessionId: string;
  date: string;
  description: string;
  amountMinor: number;
  kind: TransactionKind;
  proposedAccountId: string;
  proposedCategoryId: string;
  status: ImportItemStatus;
  included: boolean;
  note: string;
  confidence?: number;
  duplicateTransactionIds: string[];
  duplicateApproved: boolean;
  sourceReferences: string[];
  groupId?: string;
}

export interface ImportGroup {
  id: string;
  label: string;
  itemIds: string[];
  proposedDescription: string;
  proposedAmountMinor: number;
  proposedAccountId: string;
  proposedCategoryId: string;
  resolution: ImportGroupResolution;
}

export interface ImportSession {
  id: string;
  createdAt: string;
  sourceName: string;
  accountId?: string;
  status: ImportSessionStatus;
  items: ImportItem[];
  groups: ImportGroup[];
  approvedTransactionIds: string[];
}

export interface KosharaState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  importSessions: ImportSession[];
}

export interface TransactionInput {
  date: string;
  description: string;
  amountMinor: number;
  kind: TransactionKind;
  accountId: string;
  categoryId: string;
  notes?: string;
  reviewStatus?: ReviewStatus;
  source?: TransactionSource;
  confidence?: number;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  lastFour?: string;
  institution?: string;
}

export interface CategoryInput {
  name: string;
  icon?: string;
  budgetMinor?: number | null;
  color?: CategoryColor;
}

export interface ValidationIssue {
  field: keyof TransactionInput;
  code: string;
  message: string;
}

export interface TransactionValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}
