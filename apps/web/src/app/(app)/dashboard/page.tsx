'use client';

import {Grid} from '@astryxdesign/core/Grid';
import {Link} from '@astryxdesign/core/Link';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';
import {Suspense, useEffect, useMemo, useState} from 'react';

import {DashboardAccounts} from '@/components/dashboard-accounts';
import {DashboardAgentPrompts} from '@/components/dashboard-agent-prompts';
import {DashboardBudgetAttention} from '@/components/dashboard-budget-attention';
import {DashboardCategorySpending} from '@/components/dashboard-category-spending';
import {DashboardRecentTransactions} from '@/components/dashboard-recent-transactions';
import {DashboardSummaryCard} from '@/components/dashboard-summary-card';
import {DateRangeControl, useDateRangeSearchParams} from '@/components/date-range-control';
import {IncomeSpendingChart} from '@/components/income-spending-chart';
import {Page} from '@/components/page';
import {formatDateRange} from '@/lib/date-range';
import {buildDashboardViewModel} from '@/lib/dashboard-insights';
import {useKosharaLastUpdatedAt, useKosharaState} from '@/lib/koshara-store';
import {buildTransactionsHref} from '@/lib/transaction-view';

function useUpdateNotice(lastUpdatedAt: string | null) {
  const [dismissedUpdate, setDismissedUpdate] = useState<string | null>(null);

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const timer = window.setTimeout(() => setDismissedUpdate(lastUpdatedAt), 10_000);
    return () => window.clearTimeout(timer);
  }, [lastUpdatedAt]);

  return lastUpdatedAt !== null && dismissedUpdate !== lastUpdatedAt;
}

function cashflowPrompts(period: string) {
  return [
    'Analyze why my spending increased over the last three months. Update the cash-flow chart with the most useful comparison and highlight the causes.',
    `Compare income and spending for ${period}. Update the cash-flow chart to make any unusual dates easy to see.`,
    'Show my credit-card spending trend for the last three months and highlight the largest spikes.',
  ];
}

function categoryPrompts(period: string) {
  return [
    'Find the categories driving my recent spending increase. Update the category chart and highlight the biggest contributors.',
    `Explain my spending mix for ${period}. Update the category chart to focus on the categories that need attention.`,
    'Show which categories are near or over budget and highlight them in the category chart.',
  ];
}

function DashboardContent() {
  const state = useKosharaState();
  const lastUpdatedAt = useKosharaLastUpdatedAt();
  const showUpdateNotice = useUpdateNotice(lastUpdatedAt);
  const {range, preset, setRange} = useDateRangeSearchParams();
  const period = formatDateRange(range);
  const view = useMemo(() => buildDashboardViewModel(state, range), [range, state]);
  const previousPeriod = formatDateRange(view.previousRange);
  const allTransactionsHref = buildTransactionsHref({range, preset});

  return (
    <Page
      title="Dashboard"
      description="Household cash flow, budgets, accounts, and recent activity in one consistent period."
      actions={
        <HStack gap={3} vAlign="center" wrap="wrap">
          {showUpdateNotice ? (
            <HStack as="span" gap={1} vAlign="center" role="status" aria-live="polite">
              <StatusDot variant="success" label="Dashboard synchronized" isPulsing />
              <Text type="supporting" color="secondary">Updated just now</Text>
            </HStack>
          ) : null}
          <Link href={allTransactionsHref} isStandalone>View all transactions</Link>
        </HStack>
      }
    >
      <VStack gap={5} className="dashboard-page-content">
        <DateRangeControl range={range} preset={preset} onChange={setRange} />

        <Grid columns={{minWidth: 220, max: 4, repeat: 'fit'}} gap={4}>
          {view.metrics.map((metric) => (
            <DashboardSummaryCard key={metric.key} metric={metric} previousPeriod={previousPeriod} />
          ))}
        </Grid>

        <Grid className="dashboard-primary-grid" gap={5}>
          <IncomeSpendingChart state={state} range={range} />
          <DashboardAgentPrompts prompts={cashflowPrompts(period)} />
        </Grid>

        <Grid className="dashboard-primary-grid" gap={5}>
          <DashboardCategorySpending
            state={state}
            range={range}
            preset={preset}
          />
          <DashboardAgentPrompts prompts={categoryPrompts(period)} />
        </Grid>

        <Grid columns={{minWidth: 320, max: 2, repeat: 'fit'}} gap={5}>
          <DashboardBudgetAttention items={view.budgetAttention} period={period} />
          <DashboardAccounts accounts={view.accounts} />
        </Grid>

        <DashboardRecentTransactions rows={view.recentTransactions} period={period} allTransactionsHref={allTransactionsHref} />
      </VStack>
    </Page>
  );
}

function DashboardSkeleton() {
  return (
    <Page title="Dashboard" description="Loading household cash flow, budgets, accounts, and recent activity.">
      <VStack gap={5}>
        <Skeleton height="var(--spacing-12)" />
        <Grid columns={{minWidth: 220, max: 4, repeat: 'fit'}} gap={4}>
          {[0, 1, 2, 3].map((index) => <Skeleton key={index} height="calc(var(--spacing-12) * 2)" index={index} />)}
        </Grid>
        <Skeleton height="calc(var(--spacing-12) * 7)" index={4} />
      </VStack>
    </Page>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<DashboardSkeleton />}><DashboardContent /></Suspense>;
}
