import {sql} from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const personType = pgEnum('person_type', ['member', 'dependent', 'other']);
export const accountType = pgEnum('account_type', [
  'current',
  'savings',
  'credit-card',
  'cash',
  'wallet',
  'other',
]);
export const importSessionStatus = pgEnum('import_session_status', ['mapping', 'review', 'committed', 'rolled-back']);
export const importCandidateKind = pgEnum('import_candidate_kind', ['invalid', 'new', 'exact', 'probable']);
export const importCandidateDecision = pgEnum('import_candidate_decision', ['pending', 'include', 'exclude']);

const timestamps = {
  createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
};

export const households = pgTable(
  'households',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkOrganizationId: text('clerk_organization_id').notNull(),
    name: text('name').notNull(),
    baseCurrency: text('base_currency').notNull().default('INR'),
    financialYearStartMonth: integer('financial_year_start_month').notNull().default(4),
    createdByClerkUserId: text('created_by_clerk_user_id').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('households_clerk_organization_id_unique').on(table.clerkOrganizationId),
    check('households_financial_year_month_check', sql`${table.financialYearStartMonth} between 1 and 12`),
    check('households_currency_check', sql`${table.baseCurrency} ~ '^[A-Z]{3}$'`),
  ],
);

export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, {onDelete: 'cascade'}),
    displayName: text('display_name').notNull(),
    linkedClerkUserId: text('linked_clerk_user_id'),
    type: personType('type').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    unique('people_household_id_id_unique').on(table.householdId, table.id),
    uniqueIndex('people_household_linked_user_unique')
      .on(table.householdId, table.linkedClerkUserId)
      .where(sql`${table.linkedClerkUserId} is not null`),
    index('people_household_active_idx').on(table.householdId, table.active),
  ],
);

export const financialAccounts = pgTable(
  'financial_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, {onDelete: 'cascade'}),
    institutionName: text('institution_name').notNull(),
    displayName: text('display_name').notNull(),
    accountType: accountType('account_type').notNull(),
    maskedReference: text('masked_reference'),
    currency: text('currency').notNull(),
    primaryPersonId: uuid('primary_person_id').notNull(),
    joint: boolean('joint').notNull().default(false),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    unique('financial_accounts_household_id_id_unique').on(table.householdId, table.id),
    foreignKey({
      name: 'financial_accounts_primary_person_household_fk',
      columns: [table.householdId, table.primaryPersonId],
      foreignColumns: [people.householdId, people.id],
    }).onDelete('restrict'),
    index('financial_accounts_household_active_idx').on(table.householdId, table.active),
    index('financial_accounts_household_person_idx').on(table.householdId, table.primaryPersonId),
    check('financial_accounts_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);

export const financialAccountPeople = pgTable(
  'financial_account_people',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, {onDelete: 'cascade'}),
    financialAccountId: uuid('financial_account_id').notNull(),
    personId: uuid('person_id').notNull(),
  },
  (table) => [
    primaryKey({columns: [table.householdId, table.financialAccountId, table.personId]}),
    foreignKey({
      name: 'financial_account_people_account_household_fk',
      columns: [table.householdId, table.financialAccountId],
      foreignColumns: [financialAccounts.householdId, financialAccounts.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'financial_account_people_person_household_fk',
      columns: [table.householdId, table.personId],
      foreignColumns: [people.householdId, people.id],
    }).onDelete('cascade'),
    index('financial_account_people_household_person_idx').on(table.householdId, table.personId),
  ],
);

export const importSessions = pgTable(
  'import_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, {onDelete: 'cascade'}),
    financialAccountId: uuid('financial_account_id').notNull(),
    status: importSessionStatus('status').notNull().default('mapping'),
    fileCount: integer('file_count').notNull(),
    totalRows: integer('total_rows').notNull(),
    validRows: integer('valid_rows').notNull().default(0),
    invalidRows: integer('invalid_rows').notNull().default(0),
    duplicateRows: integer('duplicate_rows').notNull().default(0),
    committedTransactions: integer('committed_transactions').notNull().default(0),
    createdByClerkUserId: text('created_by_clerk_user_id').notNull(),
    committedAt: timestamp('committed_at', {withTimezone: true}),
    rolledBackAt: timestamp('rolled_back_at', {withTimezone: true}),
    ...timestamps,
  },
  (table) => [
    unique('import_sessions_household_id_id_unique').on(table.householdId, table.id),
    foreignKey({
      name: 'import_sessions_account_household_fk',
      columns: [table.householdId, table.financialAccountId],
      foreignColumns: [financialAccounts.householdId, financialAccounts.id],
    }).onDelete('restrict'),
    index('import_sessions_household_created_idx').on(table.householdId, table.createdAt),
    check(
      'import_sessions_counts_check',
      sql`${table.fileCount} > 0 and ${table.totalRows} > 0 and ${table.validRows} >= 0 and ${table.invalidRows} >= 0 and ${table.duplicateRows} >= 0 and ${table.committedTransactions} >= 0`,
    ),
  ],
);

export const importFiles = pgTable(
  'import_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id').notNull(),
    importSessionId: uuid('import_session_id').notNull(),
    originalFilename: text('original_filename').notNull(),
    headers: jsonb('headers').$type<string[]>().notNull(),
    rows: jsonb('rows').$type<Array<{rowNumber: number; values: Record<string, string>}>>().notNull(),
    mapping: jsonb('mapping').$type<Record<string, unknown>>(),
    rowCount: integer('row_count').notNull(),
    ...timestamps,
  },
  (table) => [
    unique('import_files_household_id_id_unique').on(table.householdId, table.id),
    unique('import_files_household_session_id_unique').on(table.householdId, table.importSessionId, table.id),
    foreignKey({
      name: 'import_files_session_household_fk',
      columns: [table.householdId, table.importSessionId],
      foreignColumns: [importSessions.householdId, importSessions.id],
    }).onDelete('cascade'),
    index('import_files_household_session_idx').on(table.householdId, table.importSessionId),
    check('import_files_name_length_check', sql`char_length(${table.originalFilename}) between 1 and 255`),
    check('import_files_row_count_check', sql`${table.rowCount} > 0`),
  ],
);

export const importCandidates = pgTable(
  'import_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id').notNull(),
    importSessionId: uuid('import_session_id').notNull(),
    importFileId: uuid('import_file_id').notNull(),
    rowNumber: integer('row_number').notNull(),
    transactionDate: date('transaction_date'),
    description: text('description'),
    amountMinor: bigint('amount_minor', {mode: 'number'}),
    exactFingerprint: text('exact_fingerprint'),
    kind: importCandidateKind('kind').notNull(),
    decision: importCandidateDecision('decision').notNull(),
    validationErrors: jsonb('validation_errors').$type<string[]>().notNull().default([]),
    matchedTransactionId: uuid('matched_transaction_id'),
    ...timestamps,
  },
  (table) => [
    unique('import_candidates_household_id_id_unique').on(table.householdId, table.id),
    unique('import_candidates_household_session_id_unique').on(table.householdId, table.importSessionId, table.id),
    unique('import_candidates_file_row_unique').on(table.householdId, table.importFileId, table.rowNumber),
    foreignKey({
      name: 'import_candidates_session_household_fk',
      columns: [table.householdId, table.importSessionId],
      foreignColumns: [importSessions.householdId, importSessions.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'import_candidates_file_session_household_fk',
      columns: [table.householdId, table.importSessionId, table.importFileId],
      foreignColumns: [importFiles.householdId, importFiles.importSessionId, importFiles.id],
    }).onDelete('cascade'),
    index('import_candidates_household_session_idx').on(table.householdId, table.importSessionId),
    index('import_candidates_household_fingerprint_idx').on(table.householdId, table.exactFingerprint),
    check('import_candidates_row_number_check', sql`${table.rowNumber} > 1`),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id').notNull(),
    financialAccountId: uuid('financial_account_id').notNull(),
    transactionDate: date('transaction_date').notNull(),
    description: text('description').notNull(),
    amountMinor: bigint('amount_minor', {mode: 'number'}).notNull(),
    currency: text('currency').notNull(),
    exactFingerprint: text('exact_fingerprint').notNull(),
    sourceImportSessionId: uuid('source_import_session_id').notNull(),
    sourceImportCandidateId: uuid('source_import_candidate_id').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
  },
  (table) => [
    unique('transactions_household_id_id_unique').on(table.householdId, table.id),
    unique('transactions_household_source_candidate_unique').on(table.householdId, table.sourceImportCandidateId),
    foreignKey({
      name: 'transactions_account_household_fk',
      columns: [table.householdId, table.financialAccountId],
      foreignColumns: [financialAccounts.householdId, financialAccounts.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'transactions_session_household_fk',
      columns: [table.householdId, table.sourceImportSessionId],
      foreignColumns: [importSessions.householdId, importSessions.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'transactions_candidate_session_household_fk',
      columns: [table.householdId, table.sourceImportSessionId, table.sourceImportCandidateId],
      foreignColumns: [importCandidates.householdId, importCandidates.importSessionId, importCandidates.id],
    }).onDelete('restrict'),
    index('transactions_household_date_idx').on(table.householdId, table.transactionDate),
    index('transactions_household_account_date_idx').on(table.householdId, table.financialAccountId, table.transactionDate),
    index('transactions_household_fingerprint_idx').on(table.householdId, table.exactFingerprint),
    check('transactions_amount_check', sql`${table.amountMinor} <> 0`),
    check('transactions_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);

export type Household = typeof households.$inferSelect;
export type Person = typeof people.$inferSelect;
export type FinancialAccount = typeof financialAccounts.$inferSelect;
export type ImportSession = typeof importSessions.$inferSelect;
export type ImportFile = typeof importFiles.$inferSelect;
export type ImportCandidate = typeof importCandidates.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
