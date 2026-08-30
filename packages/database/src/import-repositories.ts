import {
  DuplicateDetector,
  mapCsvRows,
  transactionFingerprint,
  type CsvColumnMapping,
  type ParsedCsv,
} from '@koshara/domain';
import {and, asc, desc, eq, gte, inArray, ne, sql} from 'drizzle-orm';

import type {KosharaDatabase} from './client';
import {
  financialAccounts,
  gmailAttachments,
  households,
  importCandidates,
  importFiles,
  importSessions,
  statementDocuments,
  transactions,
} from './schema';

type CsvImportSessionFile = {sourceType?: 'csv'; originalFilename: string; parsedCsv: ParsedCsv};
type PdfImportSessionFile = {
  sourceType: 'pdf';
  originalFilename: string;
  parsedCsv: ParsedCsv;
  document: {
    objectKey: string;
    contentType: 'application/pdf';
    byteSize: number;
    checksumSha256: string;
    pageCount: number;
    extractedTextBytes: number;
    gmailAttachmentId?: string;
  };
};

export type CreateImportSessionInput = {
  financialAccountId: string;
  createdByClerkUserId: string;
  files: Array<CsvImportSessionFile | PdfImportSessionFile>;
};

export type ImportFileMappingInput = {fileId: string; mapping: CsvColumnMapping};
export type RepositoryPageOptions = {limit?: number; offset?: number};

function pagination(options: RepositoryPageOptions, maximum: number) {
  return {
    limit: Math.min(Math.max(options.limit ?? maximum, 1), maximum),
    offset: Math.max(options.offset ?? 0, 0),
  };
}

export async function createImportSession(
  database: KosharaDatabase,
  householdId: string,
  input: CreateImportSessionInput,
) {
  if (input.files.length === 0 || input.files.length > 5) throw new Error('An import requires between one and five files');
  const totalRows = input.files.reduce((total, file) => total + file.parsedCsv.rows.length, 0);
  if (totalRows === 0 || totalRows > 25_000) throw new Error('An import requires between one and 25,000 rows');
  if (input.files.some((file) => file.originalFilename.length === 0 || file.originalFilename.length > 255)) {
    throw new Error('Import filenames must be between one and 255 characters');
  }
  const pdfFiles = input.files.filter((file): file is PdfImportSessionFile => file.sourceType === 'pdf');
  if (pdfFiles.length > 0 && (pdfFiles.length !== 1 || input.files.length !== 1)) {
    throw new Error('A PDF import requires exactly one statement document');
  }
  for (const file of pdfFiles) {
    const expectedPrefix = `households/${householdId}/statements/`;
    if (
      !file.document.objectKey.startsWith(expectedPrefix)
      || !/^households\/[0-9a-f-]{36}\/statements\/[0-9a-f-]{36}\.pdf$/u.test(file.document.objectKey)
    ) throw new Error('The statement object key is outside the household prefix');
    if (
      file.document.contentType !== 'application/pdf'
      || file.document.byteSize < 1
      || file.document.byteSize > 10 * 1024 * 1024
      || !/^[0-9a-f]{64}$/u.test(file.document.checksumSha256)
      || file.document.pageCount < 1
      || file.document.pageCount > 100
      || file.document.extractedTextBytes < 1
      || file.document.extractedTextBytes > 2 * 1024 * 1024
    ) throw new Error('The statement document metadata is invalid');
  }

  const account = await database.query.financialAccounts.findFirst({
    where: and(
      eq(financialAccounts.householdId, householdId),
      eq(financialAccounts.id, input.financialAccountId),
      eq(financialAccounts.active, true),
    ),
  });
  if (!account) throw new Error('The selected account does not belong to this household');

  return database.transaction(async (transaction) => {
    const [household] = await transaction.select({id: households.id}).from(households)
      .where(eq(households.id, householdId))
      .for('update');
    if (!household) throw new Error('The household was not found');
    const [recentSessions] = await transaction.select({count: sql<string>`count(*)`}).from(importSessions).where(and(
      eq(importSessions.householdId, householdId),
      gte(importSessions.createdAt, new Date(Date.now() - 60 * 60 * 1_000)),
    ));
    if (Number(recentSessions?.count ?? 0) >= 10) {
      throw new Error('Too many import sessions were created recently; try again later');
    }

    const [session] = await transaction.insert(importSessions).values({
      householdId,
      financialAccountId: input.financialAccountId,
      createdByClerkUserId: input.createdByClerkUserId,
      fileCount: input.files.length,
      totalRows,
    }).returning();
    if (!session) throw new Error('Import session could not be created');

    for (const file of input.files) {
      const [importFile] = await transaction.insert(importFiles).values({
        householdId,
        importSessionId: session.id,
        sourceType: file.sourceType ?? 'csv',
        originalFilename: file.originalFilename,
        headers: file.parsedCsv.headers,
        rows: file.parsedCsv.rows,
        rowCount: file.parsedCsv.rows.length,
      }).returning({id: importFiles.id});
      if (!importFile) throw new Error('Import file could not be created');
      if (file.sourceType === 'pdf') {
        const {gmailAttachmentId, ...documentMetadata} = file.document;
        await transaction.insert(statementDocuments).values({
          householdId,
          importSessionId: session.id,
          importFileId: importFile.id,
          ...documentMetadata,
        });
        if (gmailAttachmentId) {
          const [linkedAttachment] = await transaction.update(gmailAttachments).set({
            status: 'imported',
            claimedByClerkUserId: null,
            claimedAt: null,
            importSessionId: session.id,
            updatedAt: new Date(),
          }).where(and(
            eq(gmailAttachments.householdId, householdId),
            eq(gmailAttachments.id, gmailAttachmentId),
            eq(gmailAttachments.status, 'importing'),
            eq(gmailAttachments.claimedByClerkUserId, input.createdByClerkUserId),
          )).returning({id: gmailAttachments.id});
          if (!linkedAttachment) throw new Error('The Gmail attachment import claim was not found');
        }
      }
    }
    return session;
  });
}

export async function getImportSession(database: KosharaDatabase, householdId: string, importSessionId: string) {
  return database.query.importSessions.findFirst({
    where: and(eq(importSessions.householdId, householdId), eq(importSessions.id, importSessionId)),
  });
}

export async function listImportSessions(
  database: KosharaDatabase,
  householdId: string,
  options: RepositoryPageOptions = {},
) {
  const page = pagination(options, 100);
  return database
    .select({
      id: importSessions.id,
      status: importSessions.status,
      fileCount: importSessions.fileCount,
      totalRows: importSessions.totalRows,
      validRows: importSessions.validRows,
      invalidRows: importSessions.invalidRows,
      duplicateRows: importSessions.duplicateRows,
      committedTransactions: importSessions.committedTransactions,
      createdAt: importSessions.createdAt,
      committedAt: importSessions.committedAt,
      rolledBackAt: importSessions.rolledBackAt,
      accountDisplayName: financialAccounts.displayName,
    })
    .from(importSessions)
    .innerJoin(financialAccounts, and(
      eq(financialAccounts.householdId, importSessions.householdId),
      eq(financialAccounts.id, importSessions.financialAccountId),
    ))
    .where(eq(importSessions.householdId, householdId))
    .orderBy(desc(importSessions.createdAt), desc(importSessions.id))
    .limit(page.limit)
    .offset(page.offset);
}

export async function countImportSessions(database: KosharaDatabase, householdId: string) {
  const [result] = await database.select({count: sql<string>`count(*)`}).from(importSessions)
    .where(eq(importSessions.householdId, householdId));
  return Number(result?.count ?? 0);
}

export async function listImportFiles(database: KosharaDatabase, householdId: string, importSessionId: string) {
  return database
    .select()
    .from(importFiles)
    .where(and(eq(importFiles.householdId, householdId), eq(importFiles.importSessionId, importSessionId)))
    .orderBy(asc(importFiles.createdAt), asc(importFiles.id));
}

export async function getStatementDocument(database: KosharaDatabase, householdId: string, importFileId: string) {
  const document = await database.query.statementDocuments.findFirst({
    where: and(
      eq(statementDocuments.householdId, householdId),
      eq(statementDocuments.importFileId, importFileId),
    ),
  });
  if (!document) return undefined;
  const file = await database.query.importFiles.findFirst({
    columns: {originalFilename: true},
    where: and(
      eq(importFiles.householdId, householdId),
      eq(importFiles.id, importFileId),
    ),
  });
  return file ? {...document, originalFilename: file.originalFilename} : undefined;
}

export async function listStatementDocuments(database: KosharaDatabase, householdId: string, importSessionId: string) {
  return database.select({
    id: statementDocuments.id,
    importFileId: statementDocuments.importFileId,
    originalFilename: importFiles.originalFilename,
    byteSize: statementDocuments.byteSize,
    checksumSha256: statementDocuments.checksumSha256,
    pageCount: statementDocuments.pageCount,
  }).from(statementDocuments).innerJoin(importFiles, and(
    eq(importFiles.householdId, statementDocuments.householdId),
    eq(importFiles.importSessionId, statementDocuments.importSessionId),
    eq(importFiles.id, statementDocuments.importFileId),
  )).where(and(
    eq(statementDocuments.householdId, householdId),
    eq(statementDocuments.importSessionId, importSessionId),
  )).orderBy(asc(importFiles.createdAt), asc(importFiles.id));
}

export async function listImportCandidates(
  database: KosharaDatabase,
  householdId: string,
  importSessionId: string,
  options: RepositoryPageOptions = {},
) {
  const page = pagination(options, 500);
  return database
    .select({
      id: importCandidates.id,
      importFileId: importCandidates.importFileId,
      originalFilename: importFiles.originalFilename,
      rowNumber: importCandidates.rowNumber,
      transactionDate: importCandidates.transactionDate,
      description: importCandidates.description,
      amountMinor: importCandidates.amountMinor,
      kind: importCandidates.kind,
      decision: importCandidates.decision,
      validationErrors: importCandidates.validationErrors,
      matchedTransactionId: importCandidates.matchedTransactionId,
    })
    .from(importCandidates)
    .innerJoin(importFiles, and(
      eq(importFiles.householdId, importCandidates.householdId),
      eq(importFiles.id, importCandidates.importFileId),
    ))
    .where(and(
      eq(importCandidates.householdId, householdId),
      eq(importCandidates.importSessionId, importSessionId),
    ))
    .orderBy(asc(importFiles.createdAt), asc(importFiles.id), asc(importCandidates.rowNumber))
    .limit(page.limit)
    .offset(page.offset);
}

export async function countImportCandidates(database: KosharaDatabase, householdId: string, importSessionId: string) {
  const [result] = await database.select({count: sql<string>`count(*)`}).from(importCandidates).where(and(
    eq(importCandidates.householdId, householdId),
    eq(importCandidates.importSessionId, importSessionId),
  ));
  return Number(result?.count ?? 0);
}

export async function countPendingImportCandidates(
  database: KosharaDatabase,
  householdId: string,
  importSessionId: string,
) {
  const [result] = await database.select({count: sql<string>`count(*)`}).from(importCandidates).where(and(
    eq(importCandidates.householdId, householdId),
    eq(importCandidates.importSessionId, importSessionId),
    eq(importCandidates.decision, 'pending'),
  ));
  return Number(result?.count ?? 0);
}

export async function mapImportSession(
  database: KosharaDatabase,
  householdId: string,
  importSessionId: string,
  mappings: ImportFileMappingInput[],
) {
  return database.transaction(async (transaction) => {
    const [session] = await transaction
      .select()
      .from(importSessions)
      .where(and(eq(importSessions.householdId, householdId), eq(importSessions.id, importSessionId)))
      .for('update');
    if (!session) throw new Error('Import session was not found');
    if (session.status !== 'mapping' && session.status !== 'review') throw new Error('This import can no longer be mapped');

    const files = await transaction
      .select()
      .from(importFiles)
      .where(and(eq(importFiles.householdId, householdId), eq(importFiles.importSessionId, importSessionId)))
      .orderBy(asc(importFiles.createdAt), asc(importFiles.id));
    if (mappings.length !== files.length || new Set(mappings.map((mapping) => mapping.fileId)).size !== files.length) {
      throw new Error('Every import file requires one column mapping');
    }
    const mappingByFile = new Map(mappings.map((mapping) => [mapping.fileId, mapping.mapping]));
    if (files.some((file) => !mappingByFile.has(file.id))) throw new Error('A column mapping does not belong to this import');

    const existingTransactions = await transaction
      .select({
        id: transactions.id,
        financialAccountId: transactions.financialAccountId,
        transactionDate: transactions.transactionDate,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
      })
      .from(transactions)
      .where(and(
        eq(transactions.householdId, householdId),
        eq(transactions.financialAccountId, session.financialAccountId),
      ))
      .orderBy(asc(transactions.transactionDate), asc(transactions.id));
    const existingDetector = new DuplicateDetector(existingTransactions);
    const batchDetector = new DuplicateDetector([]);
    const candidateValues: Array<typeof importCandidates.$inferInsert> = [];

    for (const file of files) {
      const mapping = mappingByFile.get(file.id)!;
      const mappedRows = mapCsvRows({headers: file.headers, rows: file.rows}, mapping);
      for (const row of mappedRows) {
        const valid = row.validationErrors.length === 0
          && row.transactionDate !== null
          && row.description !== null
          && row.amountMinor !== null;
        let kind: 'invalid' | 'new' | 'exact' | 'probable' = 'invalid';
        let decision: 'pending' | 'include' | 'exclude' = 'exclude';
        let exactFingerprint: string | null = null;
        let matchedTransactionId: string | null = null;

        if (valid) {
          const comparable = {
            id: `candidate:${file.id}:${row.rowNumber}`,
            financialAccountId: session.financialAccountId,
            transactionDate: row.transactionDate!,
            description: row.description!,
            amountMinor: row.amountMinor!,
          };
          exactFingerprint = transactionFingerprint(comparable);
          const existingMatch = existingDetector.classify(comparable);
          const batchMatch = existingMatch.kind === 'new' ? batchDetector.classify(comparable) : {kind: 'new'} as const;
          const duplicate = existingMatch.kind === 'new' ? batchMatch : existingMatch;
          kind = duplicate.kind;
          decision = kind === 'new' ? 'include' : 'pending';
          if (existingMatch.kind !== 'new') matchedTransactionId = existingMatch.matchedTransactionId;
          batchDetector.add(comparable);
        }

        candidateValues.push({
          householdId,
          importSessionId,
          importFileId: file.id,
          rowNumber: row.rowNumber,
          transactionDate: row.transactionDate,
          description: row.description,
          amountMinor: row.amountMinor,
          exactFingerprint,
          kind,
          decision,
          validationErrors: row.validationErrors,
          matchedTransactionId,
        });
      }
    }

    await transaction.delete(importCandidates).where(and(
      eq(importCandidates.householdId, householdId),
      eq(importCandidates.importSessionId, importSessionId),
    ));
    for (let offset = 0; offset < candidateValues.length; offset += 1_000) {
      await transaction.insert(importCandidates).values(candidateValues.slice(offset, offset + 1_000));
    }
    for (const mapping of mappings) {
      await transaction.update(importFiles).set({mapping: mapping.mapping, updatedAt: new Date()}).where(and(
        eq(importFiles.householdId, householdId),
        eq(importFiles.importSessionId, importSessionId),
        eq(importFiles.id, mapping.fileId),
      ));
    }

    const invalidRows = candidateValues.filter((candidate) => candidate.kind === 'invalid').length;
    const duplicateRows = candidateValues.filter((candidate) => candidate.kind === 'exact' || candidate.kind === 'probable').length;
    const [updated] = await transaction.update(importSessions).set({
      status: 'review',
      validRows: candidateValues.length - invalidRows,
      invalidRows,
      duplicateRows,
      updatedAt: new Date(),
    }).where(and(eq(importSessions.householdId, householdId), eq(importSessions.id, importSessionId))).returning();
    if (!updated) throw new Error('Import session could not be mapped');
    return updated;
  });
}

export async function setImportCandidateDecision(
  database: KosharaDatabase,
  householdId: string,
  importSessionId: string,
  importCandidateId: string,
  decision: 'include' | 'exclude',
) {
  return database.transaction(async (transaction) => {
    const [session] = await transaction.select({status: importSessions.status}).from(importSessions).where(and(
      eq(importSessions.householdId, householdId),
      eq(importSessions.id, importSessionId),
    )).for('update');
    if (!session || session.status !== 'review') throw new Error('Only a review import can be changed');
    const [candidate] = await transaction.update(importCandidates).set({decision, updatedAt: new Date()}).where(and(
      eq(importCandidates.householdId, householdId),
      eq(importCandidates.importSessionId, importSessionId),
      eq(importCandidates.id, importCandidateId),
      ne(importCandidates.kind, 'invalid'),
    )).returning();
    if (!candidate) throw new Error('Import candidate was not found or is invalid');
    return candidate;
  });
}

export async function commitImportSession(database: KosharaDatabase, householdId: string, importSessionId: string) {
  const committedTransactions = await database.transaction(async (transaction) => {
    const [session] = await transaction.select().from(importSessions).where(and(
      eq(importSessions.householdId, householdId),
      eq(importSessions.id, importSessionId),
    )).for('update');
    if (!session) throw new Error('Import session was not found');
    if (session.status === 'committed') return session.committedTransactions;
    if (session.status !== 'review') throw new Error('Only a reviewed import can be committed');

    const unresolved = await transaction.select({id: importCandidates.id}).from(importCandidates).where(and(
      eq(importCandidates.householdId, householdId),
      eq(importCandidates.importSessionId, importSessionId),
      eq(importCandidates.decision, 'pending'),
    )).limit(1);
    if (unresolved.length > 0) throw new Error('Resolve every unresolved duplicate before committing');

    const [account] = await transaction.select().from(financialAccounts).where(and(
        eq(financialAccounts.householdId, householdId),
        eq(financialAccounts.id, session.financialAccountId),
    )).for('update');
    if (!account) throw new Error('The import account was not found');
    const included = await transaction.select().from(importCandidates).where(and(
      eq(importCandidates.householdId, householdId),
      eq(importCandidates.importSessionId, importSessionId),
      eq(importCandidates.decision, 'include'),
      ne(importCandidates.kind, 'invalid'),
    ));

    const existingTransactions = await transaction
      .select({
        id: transactions.id,
        financialAccountId: transactions.financialAccountId,
        transactionDate: transactions.transactionDate,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
      })
      .from(transactions)
      .where(and(
        eq(transactions.householdId, householdId),
        eq(transactions.financialAccountId, session.financialAccountId),
      ));
    const detector = new DuplicateDetector(existingTransactions);
    const staleDuplicates = included.flatMap((candidate) => {
      if (
        candidate.kind !== 'new'
        || !candidate.transactionDate
        || !candidate.description
        || candidate.amountMinor === null
      ) return [];
      const duplicate = detector.classify({
        id: candidate.id,
        financialAccountId: session.financialAccountId,
        transactionDate: candidate.transactionDate,
        description: candidate.description,
        amountMinor: candidate.amountMinor,
      });
      return duplicate.kind === 'new' ? [] : [{id: candidate.id, kind: duplicate.kind}];
    });
    if (staleDuplicates.length > 0) {
      for (const kind of ['exact', 'probable'] as const) {
        const ids = staleDuplicates.filter((candidate) => candidate.kind === kind).map((candidate) => candidate.id);
        if (ids.length > 0) {
          await transaction.update(importCandidates).set({
            kind,
            decision: 'pending',
            matchedTransactionId: null,
            updatedAt: new Date(),
          }).where(and(
            eq(importCandidates.householdId, householdId),
            eq(importCandidates.importSessionId, importSessionId),
            inArray(importCandidates.id, ids),
          ));
        }
      }
      await transaction.update(importSessions).set({
        duplicateRows: session.duplicateRows + staleDuplicates.length,
        updatedAt: new Date(),
      }).where(and(eq(importSessions.householdId, householdId), eq(importSessions.id, importSessionId)));
      return null;
    }

    const values = included.map((candidate) => {
      if (!candidate.transactionDate || !candidate.description || candidate.amountMinor === null || !candidate.exactFingerprint) {
        throw new Error('An included import candidate is incomplete');
      }
      return {
        householdId,
        financialAccountId: session.financialAccountId,
        transactionDate: candidate.transactionDate,
        description: candidate.description,
        amountMinor: candidate.amountMinor,
        currency: account.currency,
        exactFingerprint: candidate.exactFingerprint,
        sourceImportSessionId: session.id,
        sourceImportCandidateId: candidate.id,
      };
    });
    if (values.length > 0) await transaction.insert(transactions).values(values);

    await transaction.update(importSessions).set({
      status: 'committed',
      committedTransactions: values.length,
      committedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(importSessions.householdId, householdId), eq(importSessions.id, importSessionId)));
    return values.length;
  });
  if (committedTransactions === null) {
    throw new Error('New duplicates were found; return to duplicate review before committing');
  }
  return committedTransactions;
}

export async function rollbackImportSession(database: KosharaDatabase, householdId: string, importSessionId: string) {
  return database.transaction(async (transaction) => {
    const [session] = await transaction.select().from(importSessions).where(and(
      eq(importSessions.householdId, householdId),
      eq(importSessions.id, importSessionId),
    )).for('update');
    if (!session) throw new Error('Import session was not found');
    if (session.status === 'rolled-back') return 0;
    if (session.status !== 'committed') throw new Error('Only a committed import can be rolled back');

    const removed = await transaction.delete(transactions).where(and(
      eq(transactions.householdId, householdId),
      eq(transactions.sourceImportSessionId, importSessionId),
    )).returning({id: transactions.id});
    await transaction.update(importSessions).set({
      status: 'rolled-back',
      committedTransactions: 0,
      rolledBackAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(importSessions.householdId, householdId), eq(importSessions.id, importSessionId)));
    return removed.length;
  });
}

export async function listTransactions(
  database: KosharaDatabase,
  householdId: string,
  options: RepositoryPageOptions = {},
) {
  const page = pagination(options, 500);
  return database.select({
    id: transactions.id,
    transactionDate: transactions.transactionDate,
    description: transactions.description,
    amountMinor: transactions.amountMinor,
    currency: transactions.currency,
    accountDisplayName: financialAccounts.displayName,
    sourceImportSessionId: transactions.sourceImportSessionId,
    createdAt: transactions.createdAt,
  }).from(transactions).innerJoin(financialAccounts, and(
    eq(financialAccounts.householdId, transactions.householdId),
    eq(financialAccounts.id, transactions.financialAccountId),
  )).where(eq(transactions.householdId, householdId))
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt), desc(transactions.id))
    .limit(page.limit)
    .offset(page.offset);
}

export async function countTransactions(database: KosharaDatabase, householdId: string) {
  const [result] = await database.select({count: sql<string>`count(*)`}).from(transactions)
    .where(eq(transactions.householdId, householdId));
  return Number(result?.count ?? 0);
}

export async function getDashboardSummary(database: KosharaDatabase, householdId: string) {
  const summaries = await database.select({
    currency: transactions.currency,
    expenseMinor: sql<string>`coalesce(sum(case when ${transactions.amountMinor} < 0 then -${transactions.amountMinor} else 0 end), 0)`,
    incomeMinor: sql<string>`coalesce(sum(case when ${transactions.amountMinor} > 0 then ${transactions.amountMinor} else 0 end), 0)`,
    netMinor: sql<string>`coalesce(sum(${transactions.amountMinor}), 0)`,
    transactionCount: sql<string>`count(*)`,
  }).from(transactions).where(eq(transactions.householdId, householdId))
    .groupBy(transactions.currency)
    .orderBy(asc(transactions.currency));
  const currencyTotals = summaries.map((summary) => ({
    currency: summary.currency,
    expenseMinor: Number(summary.expenseMinor),
    incomeMinor: Number(summary.incomeMinor),
    netMinor: Number(summary.netMinor),
    transactionCount: Number(summary.transactionCount),
  }));
  return {
    currencyTotals,
    transactionCount: currencyTotals.reduce((total, summary) => total + summary.transactionCount, 0),
    recentTransactions: await listTransactions(database, householdId, {limit: 5}),
  };
}
