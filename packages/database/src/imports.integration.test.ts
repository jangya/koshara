import {PGlite} from '@electric-sql/pglite';
import {parseCsv} from '@koshara/domain';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import type {KosharaDatabase} from './client';
import {
  commitImportSession,
  countImportCandidates,
  countImportSessions,
  countPendingImportCandidates,
  countTransactions,
  createFinancialAccount,
  createHousehold,
  createImportSession,
  createPerson,
  getDashboardSummary,
  getImportSession,
  listImportCandidates,
  listImportFiles,
  listImportSessions,
  listTransactions,
  mapImportSession,
  rollbackImportSession,
  setImportCandidateDecision,
} from './repositories';
import * as schema from './schema';

const signedMapping = {
  dateColumn: 'Date',
  descriptionColumn: 'Description',
  dateFormat: 'dd/MM/yyyy',
  amount: {mode: 'signed', amountColumn: 'Amount'},
} as const;

describe('CSV import lifecycle repositories', () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;
  let repositoryDatabase: KosharaDatabase;

  beforeEach(async () => {
    client = new PGlite();
    database = drizzle(client, {schema});
    repositoryDatabase = database as unknown as KosharaDatabase;
    await migrate(database, {migrationsFolder: new URL('../drizzle', import.meta.url).pathname});
  });

  afterEach(async () => {
    await client.close();
  });

  async function createHouseholdAccount(suffix: string) {
    const household = await createHousehold(repositoryDatabase, {
      clerkOrganizationId: `org_${suffix}`,
      name: `${suffix} household`,
      createdByClerkUserId: `user_${suffix}`,
    });
    const person = await createPerson(repositoryDatabase, household.id, {
      displayName: `${suffix} person`,
      type: 'member',
    });
    const account = await createFinancialAccount(repositoryDatabase, household.id, {
      institutionName: 'Example Bank',
      displayName: `${suffix} account`,
      accountType: 'current',
      maskedReference: undefined,
      currency: 'INR',
      primaryPersonId: person.id,
      joint: false,
      additionalPersonIds: [],
    });
    return {household, account};
  }

  async function createMappedSession(householdId: string, accountId: string, csv: string) {
    const session = await createImportSession(repositoryDatabase, householdId, {
      financialAccountId: accountId,
      createdByClerkUserId: 'user_importer',
      files: [{originalFilename: 'statement.csv', parsedCsv: parseCsv(csv)}],
    });
    const [file] = await listImportFiles(repositoryDatabase, householdId, session.id);
    if (!file) throw new Error('Expected an import file');
    await mapImportSession(repositoryDatabase, householdId, session.id, [{fileId: file.id, mapping: signedMapping}]);
    return session;
  }

  it('rejects an import account from another household', async () => {
    const alpha = await createHouseholdAccount('alpha');
    const beta = await createHouseholdAccount('beta');

    await expect(createImportSession(repositoryDatabase, alpha.household.id, {
      financialAccountId: beta.account.id,
      createdByClerkUserId: 'user_alpha',
      files: [{originalFilename: 'statement.csv', parsedCsv: parseCsv('Date,Description,Amount\n01/02/2026,Coffee,-10')}],
    })).rejects.toThrow('account does not belong');
  });

  it('commits reviewed candidates and rolls back every sourced transaction atomically', async () => {
    const {household, account} = await createHouseholdAccount('flow');
    const session = await createMappedSession(
      household.id,
      account.id,
      'Date,Description,Amount\n01/02/2026,Groceries,-1250.75\n02/02/2026,Refund,250.25\n31/02/2026,Invalid,-10',
    );

    await expect(getImportSession(repositoryDatabase, household.id, session.id)).resolves.toMatchObject({
      status: 'review', totalRows: 3, validRows: 2, invalidRows: 1, duplicateRows: 0,
    });
    await expect(listImportCandidates(repositoryDatabase, household.id, session.id)).resolves.toMatchObject([
      {rowNumber: 2, kind: 'new', decision: 'include', amountMinor: -125075},
      {rowNumber: 3, kind: 'new', decision: 'include', amountMinor: 25025},
      {rowNumber: 4, kind: 'invalid', decision: 'exclude', amountMinor: -1000},
    ]);
    await expect(countImportCandidates(repositoryDatabase, household.id, session.id)).resolves.toBe(3);

    await expect(commitImportSession(repositoryDatabase, household.id, session.id)).resolves.toBe(2);
    await expect(commitImportSession(repositoryDatabase, household.id, session.id)).resolves.toBe(2);
    await expect(listTransactions(repositoryDatabase, household.id)).resolves.toMatchObject([
      {description: 'Refund', amountMinor: 25025, accountDisplayName: 'flow account'},
      {description: 'Groceries', amountMinor: -125075, accountDisplayName: 'flow account'},
    ]);
    await expect(listTransactions(repositoryDatabase, household.id, {limit: 1, offset: 1})).resolves.toMatchObject([
      {description: 'Groceries'},
    ]);
    await expect(countTransactions(repositoryDatabase, household.id)).resolves.toBe(2);
    await expect(getDashboardSummary(repositoryDatabase, household.id)).resolves.toMatchObject({
      transactionCount: 2,
      currencyTotals: [{currency: 'INR', expenseMinor: 125075, incomeMinor: 25025, netMinor: -100050, transactionCount: 2}],
    });

    await expect(rollbackImportSession(repositoryDatabase, household.id, session.id)).resolves.toBe(2);
    await expect(rollbackImportSession(repositoryDatabase, household.id, session.id)).resolves.toBe(0);
    await expect(listTransactions(repositoryDatabase, household.id)).resolves.toEqual([]);
    await expect(getImportSession(repositoryDatabase, household.id, session.id)).resolves.toMatchObject({
      status: 'rolled-back', committedTransactions: 0,
    });
  });

  it('blocks commit until exact and probable duplicate decisions are explicit', async () => {
    const {household, account} = await createHouseholdAccount('duplicates');
    const original = await createMappedSession(
      household.id,
      account.id,
      'Date,Description,Amount\n01/02/2026,Central Cafe,-125',
    );
    await commitImportSession(repositoryDatabase, household.id, original.id);

    const duplicateSession = await createMappedSession(
      household.id,
      account.id,
      'Date,Description,Amount\n01/02/2026, central  cafe ,-125\n03/02/2026,Central Cafe card purchase,-125',
    );
    const candidates = await listImportCandidates(repositoryDatabase, household.id, duplicateSession.id);
    expect(candidates).toMatchObject([
      {kind: 'exact', decision: 'pending'},
      {kind: 'probable', decision: 'pending'},
    ]);
    await expect(countPendingImportCandidates(repositoryDatabase, household.id, duplicateSession.id)).resolves.toBe(2);
    await expect(commitImportSession(repositoryDatabase, household.id, duplicateSession.id)).rejects.toThrow('unresolved duplicate');

    await setImportCandidateDecision(repositoryDatabase, household.id, duplicateSession.id, candidates[0]!.id, 'exclude');
    await setImportCandidateDecision(repositoryDatabase, household.id, duplicateSession.id, candidates[1]!.id, 'include');
    await expect(countPendingImportCandidates(repositoryDatabase, household.id, duplicateSession.id)).resolves.toBe(0);
    await expect(commitImportSession(repositoryDatabase, household.id, duplicateSession.id)).resolves.toBe(1);
    await expect(listTransactions(repositoryDatabase, household.id)).resolves.toHaveLength(2);
  });

  it('requires an explicit decision for duplicates within the same import session', async () => {
    const {household, account} = await createHouseholdAccount('batch_duplicates');
    const session = await createMappedSession(
      household.id,
      account.id,
      'Date,Description,Amount\n01/02/2026,Central Cafe,-125\n01/02/2026, central  cafe ,-125',
    );

    const candidates = await listImportCandidates(repositoryDatabase, household.id, session.id);
    expect(candidates).toMatchObject([
      {kind: 'new', decision: 'include'},
      {kind: 'exact', decision: 'pending'},
    ]);
    await expect(commitImportSession(repositoryDatabase, household.id, session.id)).rejects.toThrow('unresolved duplicate');
  });

  it('returns stale new candidates to duplicate review before commit', async () => {
    const {household, account} = await createHouseholdAccount('stale_review');
    const first = await createMappedSession(
      household.id,
      account.id,
      'Date,Description,Amount\n01/02/2026,Central Cafe,-125',
    );
    const second = await createMappedSession(
      household.id,
      account.id,
      'Date,Description,Amount\n01/02/2026, central  cafe ,-125',
    );

    await commitImportSession(repositoryDatabase, household.id, first.id);
    await expect(commitImportSession(repositoryDatabase, household.id, second.id)).rejects.toThrow('duplicate review');
    await expect(listImportCandidates(repositoryDatabase, household.id, second.id)).resolves.toMatchObject([
      {kind: 'exact', decision: 'pending'},
    ]);
    await expect(getImportSession(repositoryDatabase, household.id, second.id)).resolves.toMatchObject({
      status: 'review', duplicateRows: 1,
    });
  });

  it('paginates import history within one household', async () => {
    const alpha = await createHouseholdAccount('history_alpha');
    const beta = await createHouseholdAccount('history_beta');
    await database.insert(schema.importSessions).values([
      {
        householdId: alpha.household.id,
        financialAccountId: alpha.account.id,
        fileCount: 1,
        totalRows: 1,
        createdByClerkUserId: 'user_alpha_older',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        householdId: alpha.household.id,
        financialAccountId: alpha.account.id,
        fileCount: 1,
        totalRows: 1,
        createdByClerkUserId: 'user_alpha_newer',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        householdId: beta.household.id,
        financialAccountId: beta.account.id,
        fileCount: 1,
        totalRows: 1,
        createdByClerkUserId: 'user_beta',
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    ]);

    await expect(countImportSessions(repositoryDatabase, alpha.household.id)).resolves.toBe(2);
    await expect(listImportSessions(repositoryDatabase, alpha.household.id, {limit: 1, offset: 1}))
      .resolves.toMatchObject([{createdAt: new Date('2026-01-01T00:00:00.000Z')}]);
  });

  it('uses a stable final sort key when paginating transactions with equal dates and timestamps', async () => {
    const {household, account} = await createHouseholdAccount('transaction_order');
    const session = await createMappedSession(
      household.id,
      account.id,
      'Date,Description,Amount\n01/02/2026,First,-10\n01/02/2026,Second,-20\n01/02/2026,Third,-30',
    );
    const candidates = await listImportCandidates(repositoryDatabase, household.id, session.id);
    const transactionIds = [
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000003',
    ];
    const createdAt = new Date('2026-02-02T00:00:00.000Z');

    await database.insert(schema.transactions).values(candidates.map((candidate, index) => ({
      id: transactionIds[index]!,
      householdId: household.id,
      financialAccountId: account.id,
      transactionDate: candidate.transactionDate!,
      description: candidate.description!,
      amountMinor: candidate.amountMinor!,
      currency: account.currency,
      exactFingerprint: `transaction-order-${index}`,
      sourceImportSessionId: session.id,
      sourceImportCandidateId: candidate.id,
      createdAt,
    })));

    const pages = await Promise.all([0, 1, 2].map((offset) =>
      listTransactions(repositoryDatabase, household.id, {limit: 1, offset}),
    ));
    expect(pages.flat().map((transaction) => transaction.id)).toEqual([
      transactionIds[2],
      transactionIds[0],
      transactionIds[1],
    ]);
  });

  it('isolates import sessions, candidates, transactions, and dashboard metrics by household', async () => {
    const alpha = await createHouseholdAccount('isolated_alpha');
    const beta = await createHouseholdAccount('isolated_beta');
    const session = await createMappedSession(
      alpha.household.id,
      alpha.account.id,
      'Date,Description,Amount\n01/02/2026,Private,-10',
    );
    await commitImportSession(repositoryDatabase, alpha.household.id, session.id);

    await expect(getImportSession(repositoryDatabase, beta.household.id, session.id)).resolves.toBeUndefined();
    await expect(listImportCandidates(repositoryDatabase, beta.household.id, session.id)).resolves.toEqual([]);
    await expect(listTransactions(repositoryDatabase, beta.household.id)).resolves.toEqual([]);
    await expect(getDashboardSummary(repositoryDatabase, beta.household.id)).resolves.toMatchObject({
      transactionCount: 0,
      currencyTotals: [],
    });
  });

  it('rejects a candidate whose file belongs to a different import session in the same household', async () => {
    const {household, account} = await createHouseholdAccount('session_integrity');
    const first = await createMappedSession(
      household.id,
      account.id,
      'Date,Description,Amount\n01/02/2026,First,-10',
    );
    const second = await createMappedSession(
      household.id,
      account.id,
      'Date,Description,Amount\n02/02/2026,Second,-20',
    );
    const [secondFile] = await listImportFiles(repositoryDatabase, household.id, second.id);

    await expect(database.insert(schema.importCandidates).values({
      householdId: household.id,
      importSessionId: first.id,
      importFileId: secondFile!.id,
      rowNumber: 99,
      kind: 'invalid',
      decision: 'exclude',
      validationErrors: ['Synthetic integrity check'],
    })).rejects.toThrow();
  });

  it('rate limits new import sessions per household', async () => {
    const {household, account} = await createHouseholdAccount('rate_limit');
    await database.insert(schema.importSessions).values(Array.from({length: 10}, (_, index) => ({
      householdId: household.id,
      financialAccountId: account.id,
      fileCount: 1,
      totalRows: 1,
      createdByClerkUserId: `user_${index}`,
    })));

    await expect(createImportSession(repositoryDatabase, household.id, {
      financialAccountId: account.id,
      createdByClerkUserId: 'user_blocked',
      files: [{originalFilename: 'statement.csv', parsedCsv: parseCsv('Date,Description,Amount\n01/02/2026,Coffee,-10')}],
    })).rejects.toThrow('Too many import sessions');
  });
});
