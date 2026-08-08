import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {countTransactions, listTransactions} from '@koshara/database';
import type {Metadata} from 'next';

import {Page} from '@/components/page';
import {PaginationControls} from '@/components/pagination-controls';
import {getDatabase} from '@/lib/database';
import {formatMinorCurrency, formatTransactionDate} from '@/lib/format';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Transactions'};

interface TransactionRow extends Record<string, unknown> {
  id: string;
  date: string;
  account: string;
  description: string;
  amount: string;
}

const columns: TableColumn<TransactionRow>[] = [
  {key: 'date', header: 'Date', width: pixel(130)},
  {key: 'account', header: 'Account', width: proportional(1)},
  {key: 'description', header: 'Description', width: proportional(2)},
  {key: 'amount', header: 'Amount', width: pixel(150), align: 'end'},
];

const pageSize = 100;

export default async function TransactionsPage({searchParams}: {searchParams: Promise<{page?: string}>}) {
  const context = await getHouseholdPageContext();
  const totalTransactions = await countTransactions(getDatabase(), context.householdId);
  const requestedPage = Number((await searchParams).page ?? '1');
  const totalPages = Math.max(Math.ceil(totalTransactions / pageSize), 1);
  const page = Math.min(Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1, totalPages);
  const transactions = await listTransactions(getDatabase(), context.householdId, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return (
    <Page title="Transactions" description="Committed household transactions, newest statement date first.">
      {transactions.length > 0 ? (
        <Section padding={0}>
          <Table
            data={transactions.map((transaction) => ({
              id: transaction.id,
              date: formatTransactionDate(transaction.transactionDate),
              account: transaction.accountDisplayName,
              description: transaction.description,
              amount: formatMinorCurrency(transaction.amountMinor, transaction.currency),
            }))}
            columns={columns}
            idKey="id"
            density="compact"
            hasHover
            textOverflow="wrap"
            rowIndexStart={(page - 1) * pageSize + 1}
            rowCount={totalTransactions}
          />
          <PaginationControls basePath="/transactions" page={page} pageSize={pageSize} totalItems={totalTransactions} />
        </Section>
      ) : (
        <Section variant="transparent" minHeight="24rem">
          <EmptyState
            title="No committed transactions"
            description="Upload CSV statements, map their columns, and commit reviewed candidates before transactions appear here."
            actions={<Link href="/imports" isStandalone>Start a CSV import</Link>}
            headingLevel={2}
          />
        </Section>
      )}
    </Page>
  );
}
