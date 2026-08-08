import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Token} from '@astryxdesign/core/Token';
import {
  countImportCandidates,
  countPendingImportCandidates,
  getImportSession,
  listFinancialAccounts,
  listImportCandidates,
  listImportFiles,
} from '@koshara/database';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';

import {ImportCandidateTable} from '@/components/import-candidate-table';
import {ImportMappingForm} from '@/components/forms/import-mapping-form';
import {ImportSessionActions} from '@/components/import-session-actions';
import {Page} from '@/components/page';
import {PaginationControls} from '@/components/pagination-controls';
import {getDatabase} from '@/lib/database';
import {formatMinorCurrency, formatTransactionDate} from '@/lib/format';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Import review'};

const statusPresentation = {
  mapping: {label: 'Needs mapping', color: 'yellow'},
  review: {label: 'Review', color: 'blue'},
  committed: {label: 'Committed', color: 'green'},
  'rolled-back': {label: 'Rolled back', color: 'gray'},
} as const;

const pageSize = 100;

export default async function ImportSessionPage({params, searchParams}: {
  params: Promise<{importSessionId: string}>;
  searchParams: Promise<{page?: string}>;
}) {
  const context = await getHouseholdPageContext();
  const {importSessionId} = await params;
  const [session, files, accounts, totalCandidates, pendingDuplicates] = await Promise.all([
    getImportSession(getDatabase(), context.householdId, importSessionId),
    listImportFiles(getDatabase(), context.householdId, importSessionId),
    listFinancialAccounts(getDatabase(), context.householdId),
    countImportCandidates(getDatabase(), context.householdId, importSessionId),
    countPendingImportCandidates(getDatabase(), context.householdId, importSessionId),
  ]);
  if (!session) notFound();
  const account = accounts.find((candidate) => candidate.id === session.financialAccountId);
  if (!account) notFound();
  const presentation = statusPresentation[session.status];
  const requestedPage = Number((await searchParams).page ?? '1');
  const totalPages = Math.max(Math.ceil(totalCandidates / pageSize), 1);
  const page = Math.min(Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1, totalPages);
  const candidates = session.status === 'mapping' ? [] : await listImportCandidates(
    getDatabase(),
    context.householdId,
    importSessionId,
    {limit: pageSize, offset: (page - 1) * pageSize},
  );

  return (
    <Page
      title="Import review"
      description={`${account.displayName} · ${session.fileCount} file${session.fileCount === 1 ? '' : 's'} · ${session.totalRows.toLocaleString('en-IN')} rows`}
      actions={<Token label={presentation.label} color={presentation.color} />}
    >
      <VStack gap={6}>
        {session.status === 'mapping' ? (
          <Section>
            <VStack gap={4}>
              <VStack gap={1}>
                <Heading level={2}>Map statement columns</Heading>
                <Text color="secondary">Each file may use different headers, but every staged transaction uses this account’s {account.currency} currency.</Text>
              </VStack>
              <ImportMappingForm
                importSessionId={session.id}
                files={files.map((file) => ({
                  id: file.id,
                  originalFilename: file.originalFilename,
                  headers: file.headers,
                  rowCount: file.rowCount,
                }))}
              />
            </VStack>
          </Section>
        ) : (
          <VStack gap={5}>
            <Grid columns={{minWidth: 180, max: 4, repeat: 'fit'}} gap={4}>
              {[
                {label: 'Valid rows', value: session.validRows.toLocaleString('en-IN')},
                {label: 'Invalid rows', value: session.invalidRows.toLocaleString('en-IN')},
                {label: 'Duplicates', value: session.duplicateRows.toLocaleString('en-IN')},
                {label: 'Committed', value: session.committedTransactions.toLocaleString('en-IN')},
              ].map((metric) => (
                <Card key={metric.label} padding={4}>
                  <VStack gap={2}>
                    <Text type="supporting" color="secondary">{metric.label}</Text>
                    <Heading level={2} type="display-3">{metric.value}</Heading>
                  </VStack>
                </Card>
              ))}
            </Grid>
            {session.status === 'review' || session.status === 'committed' ? (
              <ImportSessionActions
                importSessionId={session.id}
                status={session.status}
                pendingDuplicates={pendingDuplicates}
              />
            ) : (
              <Text color="secondary">This import was rolled back. Its staged candidates remain as an audit trail.</Text>
            )}
            <Section padding={0}>
              <VStack gap={3}>
                <Heading level={2}>Candidates</Heading>
                <ImportCandidateTable
                  importSessionId={session.id}
                  editable={session.status === 'review'}
                  rowIndexStart={(page - 1) * pageSize + 1}
                  rowCount={totalCandidates}
                  candidates={candidates.map((candidate) => ({
                    id: candidate.id,
                    source: candidate.originalFilename,
                    rowNumber: candidate.rowNumber,
                    date: candidate.transactionDate ? formatTransactionDate(candidate.transactionDate) : '—',
                    description: candidate.description ?? '—',
                    amount: candidate.amountMinor === null ? '—' : formatMinorCurrency(candidate.amountMinor, account.currency),
                    kind: candidate.kind,
                    decision: candidate.decision,
                    issues: candidate.validationErrors.join('; ') || '—',
                  }))}
                />
                <PaginationControls
                  basePath={`/imports/${session.id}`}
                  page={page}
                  pageSize={pageSize}
                  totalItems={totalCandidates}
                />
              </VStack>
            </Section>
          </VStack>
        )}
      </VStack>
    </Page>
  );
}
