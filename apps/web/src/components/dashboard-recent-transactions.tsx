'use client';

import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {useMediaQuery} from '@astryxdesign/core/hooks';

import type {DashboardRecentTransaction} from '@/lib/dashboard-insights';
import {formatMinorCurrencySummary, formatTransactionDate} from '@/lib/format';

interface RecentRow extends Record<string, unknown> {
  id: string;
  date: string;
  description: string;
  category: string;
  account: string;
  amount: string;
}

const recentColumns: TableColumn<RecentRow>[] = [
  {key: 'date', header: 'Date', width: pixel(112)},
  {key: 'description', header: 'Description', width: proportional(2)},
  {key: 'category', header: 'Category', width: proportional(1)},
  {key: 'account', header: 'Account', width: proportional(1)},
  {
    key: 'amount',
    header: 'Amount',
    width: pixel(136),
    align: 'end',
    renderCell: (row) => <Text hasTabularNumbers justify="end">{row.amount}</Text>,
  },
];

function signedAmount(row: DashboardRecentTransaction) {
  return `${row.transaction.kind === 'expense' ? '−' : '+'}${formatMinorCurrencySummary(row.transaction.amountMinor, 'INR')}`;
}

export function DashboardRecentTransactions({
  rows,
  period,
  allTransactionsHref,
}: {
  rows: DashboardRecentTransaction[];
  period: string;
  allTransactionsHref: string;
}) {
  const isMobile = useMediaQuery('(max-width: 48rem)');
  const tableRows: RecentRow[] = rows.map((row) => ({
    id: row.transaction.id,
    date: formatTransactionDate(row.transaction.date),
    description: row.transaction.description,
    category: row.categoryName,
    account: row.accountName,
    amount: signedAmount(row),
  }));

  return (
    <Section padding={0}>
      <VStack gap={3}>
        <HStack padding={4} gap={3} vAlign="center" wrap="wrap">
          <StackItem size="fill">
            <VStack gap={1}>
              <Heading level={2}>Recent transactions</Heading>
              <Text type="supporting" color="secondary">{period}</Text>
            </VStack>
          </StackItem>
          <Link href={allTransactionsHref} isStandalone>View all transactions</Link>
        </HStack>
        {rows.length === 0 ? (
          <EmptyState title="No transactions in this period" description="Choose another period or add a transaction." headingLevel={3} />
        ) : isMobile ? (
          <VStack as="ul" gap={0} paddingInline={2} paddingBlock={2}>
            {rows.map((row) => (
              <Item
                as="li"
                key={row.transaction.id}
                label={row.transaction.description}
                labelLines={2}
                description={
                  <VStack gap={0}>
                    <Text type="supporting" color="secondary">{formatTransactionDate(row.transaction.date)} · {row.categoryName}</Text>
                    <Text type="supporting" color="secondary">{row.accountName}</Text>
                  </VStack>
                }
                endContent={<Text hasTabularNumbers>{signedAmount(row)}</Text>}
                align="start"
                density="balanced"
              />
            ))}
          </VStack>
        ) : (
          <Table data={tableRows} columns={recentColumns} idKey="id" density="compact" hasHover textOverflow="truncate" />
        )}
      </VStack>
    </Section>
  );
}
