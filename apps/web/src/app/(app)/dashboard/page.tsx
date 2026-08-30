'use client';

import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Link} from '@astryxdesign/core/Link';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';

import {Page} from '@/components/page';
import {formatMinorCurrency, formatTransactionDate} from '@/lib/format';
import {useKosharaState} from '@/lib/koshara-store';
import type {Transaction} from '@/lib/koshara-types';

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
  {key: 'amount', header: 'Amount', width: pixel(136), align: 'end'},
];

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 12).toISOString().slice(0, 10);
  return {start, end};
}

function inRange(transaction: Transaction, range: {start: string; end: string}) {
  return transaction.date >= range.start && transaction.date <= range.end;
}

export default function DashboardPage() {
  const state = useKosharaState();
  const current = monthRange(0);
  const previous = monthRange(-1);
  const currentExpenses = state.transactions.filter((transaction) => transaction.kind === 'expense' && inRange(transaction, current));
  const previousExpenses = state.transactions.filter((transaction) => transaction.kind === 'expense' && inRange(transaction, previous));
  const currentIncome = state.transactions.filter((transaction) => transaction.kind === 'income' && inRange(transaction, current));
  const currentTotal = currentExpenses.reduce((total, transaction) => total + transaction.amountMinor, 0);
  const previousTotal = previousExpenses.reduce((total, transaction) => total + transaction.amountMinor, 0);
  const incomeTotal = currentIncome.reduce((total, transaction) => total + transaction.amountMinor, 0);
  const change = previousTotal ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100) : 0;
  const categoryTotals = state.categories
    .map((category) => ({
      category,
      amountMinor: currentExpenses.filter((transaction) => transaction.categoryId === category.id)
        .reduce((total, transaction) => total + transaction.amountMinor, 0),
    }))
    .filter((item) => item.amountMinor > 0)
    .sort((a, b) => b.amountMinor - a.amountMinor);
  const accountName = new Map(state.accounts.map((account) => [account.id, account.name]));
  const categoryName = new Map(state.categories.map((category) => [category.id, category.name]));
  const recentRows = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map((transaction) => ({
    id: transaction.id,
    date: formatTransactionDate(transaction.date),
    description: transaction.description,
    category: categoryName.get(transaction.categoryId) ?? 'Uncategorized',
    account: accountName.get(transaction.accountId) ?? 'Unknown account',
    amount: `${transaction.kind === 'expense' ? '−' : '+'}${formatMinorCurrency(transaction.amountMinor, 'INR')}`,
  }));

  return (
    <Page
      title="Dashboard"
      description="A clear view of this month across the Mehta household."
      actions={<Link href="/transactions" isStandalone>View all transactions</Link>}
    >
      <VStack gap={5}>
        <Grid columns={{minWidth: 220, max: 4, repeat: 'fit'}} gap={4}>
          <Card padding={4}>
            <VStack gap={2}>
              <Text type="supporting" color="secondary">Spent this month</Text>
              <Heading level={2} type="display-3">{formatMinorCurrency(currentTotal, 'INR')}</Heading>
              <Text type="supporting" color="secondary">
                {change > 0 ? '↑' : '↓'} {Math.abs(change)}% from last month
              </Text>
            </VStack>
          </Card>
          <Card padding={4}>
            <VStack gap={2}>
              <Text type="supporting" color="secondary">Income this month</Text>
              <Heading level={2} type="display-3">{formatMinorCurrency(incomeTotal, 'INR')}</Heading>
              <Text type="supporting" color="secondary">Across {currentIncome.length} credit{currentIncome.length === 1 ? '' : 's'}</Text>
            </VStack>
          </Card>
          <Card padding={4}>
            <VStack gap={2}>
              <Text type="supporting" color="secondary">Transactions</Text>
              <Heading level={2} type="display-3">{currentExpenses.length}</Heading>
              <Text type="supporting" color="secondary">{formatMinorCurrency(previousTotal, 'INR')} last month</Text>
            </VStack>
          </Card>
          <Card padding={4}>
            <VStack gap={2}>
              <Text type="supporting" color="secondary">Largest category</Text>
              <Heading level={2} type="display-3">{categoryTotals[0]?.category.name ?? '—'}</Heading>
              <Text type="supporting" color="secondary">{categoryTotals[0] ? formatMinorCurrency(categoryTotals[0].amountMinor, 'INR') : 'No spending yet'}</Text>
            </VStack>
          </Card>
        </Grid>

        <Grid columns={{minWidth: 300, max: 2, repeat: 'fit'}} gap={5}>
          <Section>
            <VStack gap={4}>
              <HStack gap={3} vAlign="center">
                <StackItem size="fill"><Heading level={2}>Spending by category</Heading></StackItem>
                <Text type="supporting" color="secondary">This month</Text>
              </HStack>
              <VStack as="ul" gap={1}>
                {categoryTotals.slice(0, 6).map(({category, amountMinor}) => (
                  <Item
                    as="li"
                    key={category.id}
                    label={category.name}
                    description={
                      <ProgressBar
                        label={`${category.name} share of monthly spending`}
                        value={amountMinor}
                        max={currentTotal || 1}
                        isLabelHidden
                        variant="accent"
                      />
                    }
                    endContent={formatMinorCurrency(amountMinor, 'INR')}
                    density="balanced"
                  />
                ))}
              </VStack>
            </VStack>
          </Section>

          <Section>
            <VStack gap={4}>
              <Heading level={2}>Accounts</Heading>
              <VStack as="ul" gap={0}>
                {state.accounts.map((account) => (
                  <Item
                    as="li"
                    key={account.id}
                    label={account.name}
                    description={[account.institution, account.lastFour ? `•••• ${account.lastFour}` : null].filter(Boolean).join(' · ') || 'No institution details'}
                    endContent={
                      <VStack gap={0} hAlign="end">
                        <Text>{formatMinorCurrency(account.balanceMinor, 'INR')}</Text>
                        <Text type="supporting" color="secondary">{account.type === 'credit-card' ? 'Outstanding' : 'Available'}</Text>
                      </VStack>
                    }
                    density="spacious"
                  />
                ))}
              </VStack>
            </VStack>
          </Section>
        </Grid>

        <Section padding={0}>
          <VStack gap={3}>
            <HStack padding={4}>
              <Heading level={2}>Recent transactions</Heading>
            </HStack>
            <Table data={recentRows} columns={recentColumns} idKey="id" density="compact" hasHover textOverflow="truncate" />
          </VStack>
        </Section>
      </VStack>
    </Page>
  );
}
