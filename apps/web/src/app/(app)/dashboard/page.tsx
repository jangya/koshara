import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {getDashboardSummary} from '@koshara/database';
import type {Metadata} from 'next';

import {Page} from '@/components/page';
import {getDatabase} from '@/lib/database';
import {formatMinorCurrency, formatTransactionDate} from '@/lib/format';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Dashboard'};

interface RecentTransactionRow extends Record<string, unknown> {
  id: string;
  date: string;
  account: string;
  description: string;
  amount: string;
}

const recentColumns: TableColumn<RecentTransactionRow>[] = [
  {key: 'date', header: 'Date', width: pixel(120)},
  {key: 'account', header: 'Account', width: proportional(1)},
  {key: 'description', header: 'Description', width: proportional(2)},
  {key: 'amount', header: 'Amount', width: pixel(140), align: 'end'},
];

export default async function DashboardPage() {
  const context = await getHouseholdPageContext();
  const summary = await getDashboardSummary(getDatabase(), context.householdId);
  const metrics = [
    {label: 'Transactions', value: summary.transactionCount.toLocaleString('en-IN')},
    ...summary.currencyTotals.flatMap((currency) => [
      {label: `${currency.currency} expenses`, value: formatMinorCurrency(currency.expenseMinor, currency.currency)},
      {label: `${currency.currency} income`, value: formatMinorCurrency(currency.incomeMinor, currency.currency)},
      {label: `${currency.currency} net flow`, value: formatMinorCurrency(currency.netMinor, currency.currency)},
    ]),
  ];
  return (
    <Page title="Dashboard" description="Cash-flow totals from committed household transactions only; currencies are never combined without conversion.">
      <VStack gap={5}>
        <Grid columns={{minWidth: 220, max: 4, repeat: 'fit'}} gap={4}>
          {metrics.map((metric) => (
            <Card key={metric.label} padding={4}>
              <VStack gap={2}>
                <Text type="supporting" color="secondary">{metric.label}</Text>
                <Heading level={2} type="display-3">{metric.value}</Heading>
              </VStack>
            </Card>
          ))}
        </Grid>
        {summary.recentTransactions.length > 0 ? (
          <Section padding={0}>
            <VStack gap={3}>
              <Heading level={2}>Recent transactions</Heading>
              <Table
                data={summary.recentTransactions.map((transaction) => ({
                  id: transaction.id,
                  date: formatTransactionDate(transaction.transactionDate),
                  account: transaction.accountDisplayName,
                  description: transaction.description,
                  amount: formatMinorCurrency(transaction.amountMinor, transaction.currency),
                }))}
                columns={recentColumns}
                idKey="id"
                density="compact"
                hasHover
              />
            </VStack>
          </Section>
        ) : (
          <Section padding={6} minHeight="20rem">
            <EmptyState
              title="No household transactions yet"
              description="Commit a reviewed CSV import to populate real dashboard metrics. No sample financial data is shown."
              actions={<Link href="/imports" isStandalone>Start a CSV import</Link>}
              headingLevel={2}
            />
          </Section>
        )}
      </VStack>
    </Page>
  );
}
