import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import type {KosharaDatabase} from './client';
import {
  commitImportSession,
  createFinancialAccount,
  createHousehold,
  createImportSession,
  createPerson,
  getStatementDocument,
  listImportCandidates,
  listImportFiles,
  listTransactions,
  mapImportSession,
  rollbackImportSession,
} from './repositories';
import * as schema from './schema';

const parsedPdfRows = {
  headers: ['Column 1', 'Column 2', 'Column 3'],
  rows: [
    {rowNumber: 2, values: {'Column 1': 'Date', 'Column 2': 'Description', 'Column 3': 'Amount'}},
    {rowNumber: 3, values: {'Column 1': '01/02/2026', 'Column 2': 'Synthetic coffee', 'Column 3': '-10.50'}},
  ],
};

const mapping = {
  dateColumn: 'Column 1',
  descriptionColumn: 'Column 2',
  dateFormat: 'dd/MM/yyyy',
  amount: {mode: 'signed', amountColumn: 'Column 3'},
} as const;

describe('PDF statement document repositories', () => {
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

  async function householdAccount(suffix: string) {
    const household = await createHousehold(repositoryDatabase, {
      clerkOrganizationId: `org_pdf_${suffix}`,
      name: `${suffix} household`,
      createdByClerkUserId: `user_${suffix}`,
    });
    const person = await createPerson(repositoryDatabase, household.id, {
      displayName: `${suffix} person`,
      type: 'member',
    });
    const account = await createFinancialAccount(repositoryDatabase, household.id, {
      institutionName: 'Synthetic Bank',
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

  async function createPdfSession(householdId: string, accountId: string) {
    return createImportSession(repositoryDatabase, householdId, {
      financialAccountId: accountId,
      createdByClerkUserId: 'user_pdf_importer',
      files: [{
        sourceType: 'pdf',
        originalFilename: 'synthetic-statement.pdf',
        parsedCsv: parsedPdfRows,
        document: {
          objectKey: `households/${householdId}/statements/11111111-1111-4111-8111-111111111111.pdf`,
          contentType: 'application/pdf',
          byteSize: 2_048,
          checksumSha256: 'a'.repeat(64),
          pageCount: 1,
          extractedTextBytes: 128,
        },
      }],
    });
  }

  it('stores household-scoped metadata without a bucket or public URL', async () => {
    const alpha = await householdAccount('alpha');
    const beta = await householdAccount('beta');
    const session = await createPdfSession(alpha.household.id, alpha.account.id);
    const [file] = await listImportFiles(repositoryDatabase, alpha.household.id, session.id);
    const document = await getStatementDocument(repositoryDatabase, alpha.household.id, file!.id);

    expect(file).toMatchObject({sourceType: 'pdf', originalFilename: 'synthetic-statement.pdf'});
    expect(document).toMatchObject({
      householdId: alpha.household.id,
      importSessionId: session.id,
      importFileId: file!.id,
      checksumSha256: 'a'.repeat(64),
      pageCount: 1,
    });
    expect(Object.keys(document!)).not.toContain('url');
    await expect(getStatementDocument(repositoryDatabase, beta.household.id, file!.id)).resolves.toBeUndefined();
  });

  it('stages, commits, and rolls back extracted PDF rows through the existing pipeline', async () => {
    const {household, account} = await householdAccount('pipeline');
    const session = await createPdfSession(household.id, account.id);
    const [file] = await listImportFiles(repositoryDatabase, household.id, session.id);

    await mapImportSession(repositoryDatabase, household.id, session.id, [{fileId: file!.id, mapping}]);
    await expect(listImportCandidates(repositoryDatabase, household.id, session.id)).resolves.toMatchObject([
      {rowNumber: 2, kind: 'invalid', decision: 'exclude'},
      {rowNumber: 3, kind: 'new', decision: 'include', description: 'Synthetic coffee', amountMinor: -1050},
    ]);
    await expect(commitImportSession(repositoryDatabase, household.id, session.id)).resolves.toBe(1);
    await expect(listTransactions(repositoryDatabase, household.id)).resolves.toMatchObject([
      {description: 'Synthetic coffee', sourceImportSessionId: session.id},
    ]);
    await expect(rollbackImportSession(repositoryDatabase, household.id, session.id)).resolves.toBe(1);
    await expect(listTransactions(repositoryDatabase, household.id)).resolves.toEqual([]);
    await expect(getStatementDocument(repositoryDatabase, household.id, file!.id)).resolves.toMatchObject({
      importSessionId: session.id,
    });
  });

  it('rejects object keys outside the household prefix', async () => {
    const {household, account} = await householdAccount('prefix');
    await expect(createImportSession(repositoryDatabase, household.id, {
      financialAccountId: account.id,
      createdByClerkUserId: 'user_prefix',
      files: [{
        sourceType: 'pdf',
        originalFilename: 'synthetic.pdf',
        parsedCsv: parsedPdfRows,
        document: {
          objectKey: 'households/another-household/statements/object.pdf',
          contentType: 'application/pdf',
          byteSize: 2_048,
          checksumSha256: 'b'.repeat(64),
          pageCount: 1,
          extractedTextBytes: 128,
        },
      }],
    })).rejects.toThrow('object key');
  });

  it('rejects document metadata that crosses import-session provenance', async () => {
    const {household, account} = await householdAccount('provenance');
    const firstSession = await createImportSession(repositoryDatabase, household.id, {
      financialAccountId: account.id,
      createdByClerkUserId: 'user_provenance',
      files: [{originalFilename: 'first.csv', parsedCsv: parsedPdfRows}],
    });
    const secondSession = await createImportSession(repositoryDatabase, household.id, {
      financialAccountId: account.id,
      createdByClerkUserId: 'user_provenance',
      files: [{originalFilename: 'second.csv', parsedCsv: parsedPdfRows}],
    });
    const [firstFile] = await listImportFiles(repositoryDatabase, household.id, firstSession.id);

    await expect(database.insert(schema.statementDocuments).values({
      householdId: household.id,
      importSessionId: secondSession.id,
      importFileId: firstFile!.id,
      objectKey: `households/${household.id}/statements/22222222-2222-4222-8222-222222222222.pdf`,
      contentType: 'application/pdf',
      byteSize: 2_048,
      checksumSha256: 'c'.repeat(64),
      pageCount: 1,
      extractedTextBytes: 128,
    })).rejects.toThrow();
  });
});
