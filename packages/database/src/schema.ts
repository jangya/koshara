import {sql} from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
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

export type Household = typeof households.$inferSelect;
export type Person = typeof people.$inferSelect;
export type FinancialAccount = typeof financialAccounts.$inferSelect;
