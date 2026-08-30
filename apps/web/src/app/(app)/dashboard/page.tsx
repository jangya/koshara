'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Link} from '@astryxdesign/core/Link';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Section} from '@astryxdesign/core/Section';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {Suspense, useEffect, useMemo, useState} from 'react';

import {DateRangeControl, useDateRangeSearchParams} from '@/components/date-range-control';
import {IncomeSpendingChart} from '@/components/income-spending-chart';
import {Page} from '@/components/page';
import {getBudgetStatus} from '@/lib/category-rules';
import {aggregateTimeline, formatDateRange, getPreviousPeriod, isInDateRange} from '@/lib/date-range';
import {compareMetric, summarizeTransactions} from '@/lib/finance-insights';
import {formatMinorCurrencySummary, formatTransactionDate} from '@/lib/format';
import {useKosharaState} from '@/lib/koshara-store';

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

function comparisonCopy(current: number, previous: number, previousPeriod: string) {
  const comparison = compareMetric(current, previous);
  if (comparison.direction === 'unchanged') return `Unchanged from ${previousPeriod}`;
  if (comparison.direction === 'new') return `No comparable activity in ${previousPeriod}`;
  return `${comparison.percent}% ${comparison.direction} than ${previousPeriod}`;
}

function useKpiColumnCount() {
  const [columns, setColumns] = useState(2);
  useEffect(() => {
    function update() {
      if (window.innerWidth >= 1280) setColumns(4);
      else if (window.innerWidth >= 600) setColumns(2);
      else setColumns(1);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return columns;
}

function DashboardContent() {
  const state = useKosharaState();
  const {range, preset, setRange} = useDateRangeSearchParams();
  const kpiColumns = useKpiColumnCount();
  const period = formatDateRange(range);
  const previousRange = getPreviousPeriod(range);
  const previousPeriod = formatDateRange(previousRange);
  const summary = summarizeTransactions(state.transactions, range);
  const previousSummary = summarizeTransactions(state.transactions, previousRange);
  const selectedTransactions = useMemo(
    () => state.transactions.filter((transaction) => isInDateRange(transaction.date, range)),
    [range, state.transactions],
  );
  const categoryTotals = useMemo(() => state.categories
    .map((category) => ({
      category,
      amountMinor: selectedTransactions
        .filter((transaction) => transaction.kind === 'expense' && transaction.categoryId === category.id)
        .reduce((total, transaction) => total + transaction.amountMinor, 0),
    }))
    .filter(({amountMinor}) => amountMinor > 0)
    .sort((a, b) => b.amountMinor - a.amountMinor), [selectedTransactions, state.categories]);
  const timeline = useMemo(() => aggregateTimeline(selectedTransactions, range), [range, selectedTransactions]);
  const accountName = new Map(state.accounts.map((account) => [account.id, account.name]));
  const categoryName = new Map(state.categories.map((category) => [category.id, category.name]));
  const recentRows: RecentRow[] = [...selectedTransactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7)
    .map((transaction) => ({
      id: transaction.id,
      date: formatTransactionDate(transaction.date),
      description: transaction.description,
      category: categoryName.get(transaction.categoryId) ?? 'Uncategorized',
      account: accountName.get(transaction.accountId) ?? 'Unknown account',
      amount: `${transaction.kind === 'expense' ? '−' : '+'}${formatMinorCurrencySummary(transaction.amountMinor, 'INR')}`,
    }));
  const metrics = [
    {
      label: 'Spending',
      value: formatMinorCurrencySummary(summary.spendingMinor, 'INR'),
      comparison: comparisonCopy(summary.spendingMinor, previousSummary.spendingMinor, previousPeriod),
    },
    {
      label: 'Income',
      value: formatMinorCurrencySummary(summary.incomeMinor, 'INR'),
      comparison: comparisonCopy(summary.incomeMinor, previousSummary.incomeMinor, previousPeriod),
    },
    {
      label: 'Net cash flow',
      value: formatMinorCurrencySummary(summary.netCashFlowMinor, 'INR'),
      comparison: comparisonCopy(summary.netCashFlowMinor, previousSummary.netCashFlowMinor, previousPeriod),
    },
    {
      label: 'Transactions',
      value: new Intl.NumberFormat('en-IN').format(summary.transactionCount),
      comparison: comparisonCopy(summary.transactionCount, previousSummary.transactionCount, previousPeriod),
    },
  ];
  const rangeQuery = `from=${range.start}&to=${range.end}&range=${preset}`;

  return (
    <Page
      title="Dashboard"
      description="Household cash flow, budgets, accounts, and recent activity in one consistent period."
      actions={<Link href={`/transactions?${rangeQuery}`} isStandalone>View all transactions</Link>}
    >
      <VStack gap={5}>
        <DateRangeControl range={range} preset={preset} onChange={setRange} />

        {summary.needsReviewCount > 0 ? (
          <Banner
            status="warning"
            title={`${summary.needsReviewCount} ${summary.needsReviewCount === 1 ? 'transaction needs' : 'transactions need'} review`}
            description={`Resolve uncertain categories and details from ${period}.`}
            endContent={<Link href={`/transactions?${rangeQuery}&review=needs_review`} isStandalone>Review now</Link>}
          />
        ) : null}

        <Grid columns={kpiColumns} gap={4}>
          {metrics.map((metric) => (
            <Card key={metric.label} padding={4}>
              <VStack gap={2}>
                <Text type="supporting" color="secondary">{metric.label}</Text>
                <Text type="display-3" hasTabularNumbers justify="end">{metric.value}</Text>
                <Text type="supporting" color="secondary">{metric.comparison}</Text>
              </VStack>
            </Card>
          ))}
        </Grid>

        <IncomeSpendingChart points={timeline} period={period} />

        <Grid columns={{minWidth: 300, max: 2, repeat: 'fit'}} gap={5}>
          <Section>
            <VStack gap={4}>
              <HStack gap={3} vAlign="center">
                <StackItem size="fill"><Heading level={2}>Spending by category</Heading></StackItem>
                <Text type="supporting" color="secondary">{period}</Text>
              </HStack>
              {categoryTotals.length > 0 ? (
                <VStack as="ul" gap={1}>
                  {categoryTotals.slice(0, 8).map(({category, amountMinor}) => {
                    const share = summary.spendingMinor ? Math.round((amountMinor / summary.spendingMinor) * 100) : 0;
                    const budgetStatus = category.budgetMinor !== null && range.start.slice(0, 7) === range.end.slice(0, 7)
                      ? getBudgetStatus(amountMinor, category.budgetMinor)
                      : null;
                    return (
                      <Item
                        as="li"
                        key={category.id}
                        label={
                          <Link href={`/transactions?${rangeQuery}&category=${encodeURIComponent(category.id)}`} isStandalone>
                            {category.name}
                          </Link>
                        }
                        description={
                          <VStack gap={1}>
                            <Text type="supporting" color="secondary">
                              {share}% of spending{budgetStatus ? ` · ${budgetStatus.label}` : ''}
                            </Text>
                            <ProgressBar
                              label={`${category.name}: ${share}% of selected spending${budgetStatus ? `, ${budgetStatus.label}` : ''}`}
                              value={amountMinor}
                              max={summary.spendingMinor || 1}
                              isLabelHidden
                              variant={budgetStatus?.label === 'Over budget' ? 'warning' : 'accent'}
                            />
                          </VStack>
                        }
                        endContent={<Text hasTabularNumbers justify="end">{formatMinorCurrencySummary(amountMinor, 'INR')}</Text>}
                        density="balanced"
                        align="start"
                      />
                    );
                  })}
                </VStack>
              ) : (
                <EmptyState title="No category spending" description={`No expenses were recorded in ${period}.`} headingLevel={3} />
              )}
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
                        <Text hasTabularNumbers>{formatMinorCurrencySummary(account.balanceMinor, 'INR')}</Text>
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
            <HStack padding={4} vAlign="center">
              <StackItem size="fill"><Heading level={2}>Recent transactions</Heading></StackItem>
              <Text type="supporting" color="secondary">{period}</Text>
            </HStack>
            {recentRows.length > 0 ? (
              <Table data={recentRows} columns={recentColumns} idKey="id" density="compact" hasHover textOverflow="truncate" />
            ) : (
              <EmptyState title="No transactions in this period" description="Choose another period or add a transaction." headingLevel={3} />
            )}
          </VStack>
        </Section>

      </VStack>
    </Page>
  );
}

function DashboardSkeleton() {
  return (
    <Page title="Dashboard" description="Loading household cash flow, budgets, accounts, and recent activity.">
      <VStack gap={5}>
        <Skeleton height="var(--spacing-12)" />
        <Grid columns={2} gap={4}>
          {[0, 1, 2, 3].map((index) => <Skeleton key={index} height="calc(var(--spacing-12) * 2)" index={index} />)}
        </Grid>
        <Skeleton height="calc(var(--spacing-12) * 5)" index={4} />
      </VStack>
    </Page>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<DashboardSkeleton />}><DashboardContent /></Suspense>;
}
