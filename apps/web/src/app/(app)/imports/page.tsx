import {Divider} from '@astryxdesign/core/Divider';
import {Heading} from '@astryxdesign/core/Heading';
import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {countImportSessions, listFinancialAccounts, listImportSessions} from '@koshara/database';
import type {Metadata} from 'next';

import {ImportUploadForm} from '@/components/forms/import-upload-form';
import {ImportSessionTable} from '@/components/import-session-table';
import {Page} from '@/components/page';
import {PaginationControls} from '@/components/pagination-controls';
import {getDatabase} from '@/lib/database';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Imports'};

const pageSize = 25;

export default async function ImportsPage({searchParams}: {searchParams: Promise<{page?: string}>}) {
  const context = await getHouseholdPageContext();
  const [accounts, totalSessions] = await Promise.all([
    listFinancialAccounts(getDatabase(), context.householdId),
    countImportSessions(getDatabase(), context.householdId),
  ]);
  const requestedPage = Number((await searchParams).page ?? '1');
  const totalPages = Math.max(Math.ceil(totalSessions / pageSize), 1);
  const page = Math.min(Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1, totalPages);
  const sessions = await listImportSessions(getDatabase(), context.householdId, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return (
    <Page title="Imports" description="Upload CSV statements, map their columns, and review candidates before committing anything.">
      <VStack gap={6}>
        <Section>
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>New CSV import</Heading>
              <Text color="secondary">Files stay staged in an import session until every duplicate decision is resolved.</Text>
            </VStack>
            {accounts.length > 0 ? (
              <ImportUploadForm accounts={accounts.map(({id, displayName}) => ({id, displayName}))} />
            ) : (
              <Text color="secondary">
                Add a <Link href="/accounts">financial account</Link> before importing statements.
              </Text>
            )}
          </VStack>
        </Section>
        <Divider />
        <Section padding={0}>
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>Import history</Heading>
              <Text color="secondary">Committed imports remain available for complete rollback.</Text>
            </VStack>
            {sessions.length > 0 ? (
              <>
                <ImportSessionTable
                  sessions={sessions.map((session) => ({
                    id: session.id,
                    account: session.accountDisplayName,
                    created: session.createdAt.toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}),
                    files: session.fileCount,
                    rows: session.totalRows,
                    status: session.status,
                  }))}
                  rowIndexStart={(page - 1) * pageSize + 1}
                  rowCount={totalSessions}
                />
                <PaginationControls basePath="/imports" page={page} pageSize={pageSize} totalItems={totalSessions} />
              </>
            ) : <Text color="secondary">No CSV import sessions have been created.</Text>}
          </VStack>
        </Section>
      </VStack>
    </Page>
  );
}
