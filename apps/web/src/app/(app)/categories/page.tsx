'use client';

import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {Selector} from '@astryxdesign/core/Selector';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Suspense, useMemo, useState} from 'react';

import {CategoryAnalyticsItem} from '@/components/category-analytics-item';
import {CategoryDialog} from '@/components/category-dialog';
import {CategoryOverview} from '@/components/category-overview';
import {DateRangeControl, useDateRangeSearchParams} from '@/components/date-range-control';
import {Page} from '@/components/page';
import {
  buildCategoryAnalytics,
  filterCategoryAnalytics,
  sortCategoryAnalytics,
  type CategorySortKey,
  type CategoryViewFilter,
} from '@/lib/category-analytics';
import {formatDateRange} from '@/lib/date-range';
import {formatMinorCurrencySummary} from '@/lib/format';
import {deleteCategory, useKosharaState} from '@/lib/koshara-store';
import type {Category} from '@/lib/koshara-types';
import {buildTransactionsHref} from '@/lib/transaction-view';

function CategoriesContent() {
  const state = useKosharaState();
  const {range, preset, setRange} = useDateRangeSearchParams();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filter, setFilter] = useState<CategoryViewFilter>('active');
  const [sortBy, setSortBy] = useState<CategorySortKey>('attention');
  const analytics = useMemo(() => buildCategoryAnalytics(state.categories, state.transactions, range), [range, state.categories, state.transactions]);
  const period = formatDateRange(range);
  const filteredRows = sortCategoryAnalytics(filterCategoryAnalytics(analytics.rows, filter), sortBy);
  const primaryRows = filter === 'all'
    ? filteredRows.filter((row) => row.spendingMinor > 0 && !row.isNonSpending && !row.isUncategorized)
    : filteredRows;
  const noActivityRows = sortCategoryAnalytics(analytics.rows.filter((row) => row.spendingMinor === 0 && !row.isNonSpending && !row.isUncategorized), 'name');
  const financialRows = sortCategoryAnalytics(analytics.rows.filter(({isNonSpending}) => isNonSpending), 'spending');
  const linkedTransactionCount = deleting ? state.transactions.filter(({categoryId}) => categoryId === deleting.id).length : 0;
  const showSupplementary = filter === 'active' || filter === 'all';

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setEditorOpen(true);
  }

  function categoryItem(row: (typeof analytics.rows)[number]) {
    return (
      <CategoryAnalyticsItem
        key={row.category.id}
        row={row}
        transactionsHref={buildTransactionsHref({range, preset, categoryId: row.category.id})}
        onEdit={() => openEdit(row.category)}
        onDelete={() => setDeleting(row.category)}
      />
    );
  }

  return (
    <>
      <Page
        title="Categories"
        description="Understand category health, budgets, and transactions for one exact period."
        actions={<Button label="Add category" variant="primary" onClick={openCreate} />}
        contentWidth="calc(var(--spacing-12) * 27)"
      >
        <VStack gap={4}>
          <DateRangeControl range={range} preset={preset} onChange={setRange} />
          <CategoryOverview overview={analytics.overview} period={period} />

          {analytics.overview.uncategorizedCount > 0 ? (
            <Banner
              status="warning"
              title={`${analytics.overview.uncategorizedCount} uncategorized ${analytics.overview.uncategorizedCount === 1 ? 'transaction' : 'transactions'}`}
              description={`${formatMinorCurrencySummary(analytics.overview.uncategorizedAmountMinor, 'INR')} needs categorization for ${period}.`}
              endContent={<Link href={buildTransactionsHref({range, preset, categoryId: 'uncategorized'})} isStandalone>Open transactions</Link>}
            />
          ) : (
            <Banner status="success" title={`Everything is categorized for ${period}`} description="No uncategorized activity needs attention." />
          )}

          <Section>
            <VStack gap={3}>
              <HStack gap={3} vAlign="center" wrap="wrap">
                <StackItem size="fill">
                  <VStack gap={0}>
                    <Heading level={2}>Category health</Heading>
                    <Text type="supporting" color="secondary">Everyday spending categories</Text>
                  </VStack>
                </StackItem>
                <Selector
                  label="Category view"
                  value={filter}
                  onChange={(value) => setFilter(value as CategoryViewFilter)}
                  options={[
                    {value: 'active', label: 'Active'},
                    {value: 'all', label: 'All'},
                    {value: 'over-budget', label: `Over budget (${analytics.overview.overBudgetCount})`},
                    {value: 'near-limit', label: `Near limit (${analytics.overview.nearBudgetCount})`},
                    {value: 'needs-budget', label: `Needs a budget (${analytics.overview.categoriesWithoutBudgetCount})`},
                    {value: 'uncategorized', label: `Uncategorized (${analytics.overview.uncategorizedCount})`},
                  ]}
                  isLabelHidden
                />
                <Selector
                  label="Sort categories"
                  value={sortBy}
                  onChange={(value) => setSortBy(value as CategorySortKey)}
                  options={[
                    {value: 'attention', label: 'Needs attention'},
                    {value: 'spending', label: 'Highest spending'},
                    {value: 'usage', label: 'Budget usage'},
                    {value: 'change', label: 'Largest increase'},
                    {value: 'name', label: 'Name'},
                  ]}
                  isLabelHidden
                />
              </HStack>
              {primaryRows.length > 0 ? (
                <VStack as="ul" gap={0}>{primaryRows.map(categoryItem)}</VStack>
              ) : (
                <EmptyState title="No categories match this view" description={`Choose another category view for ${period}.`} headingLevel={3} />
              )}
            </VStack>
          </Section>

          {showSupplementary && noActivityRows.length > 0 ? (
            <Section variant="transparent" dividers={['top']}>
              <VStack gap={3}>
                <HStack gap={3} vAlign="center"><StackItem size="fill"><Heading level={2}>No activity in this period</Heading></StackItem><Text type="supporting" color="secondary">{noActivityRows.length} categories</Text></HStack>
                <VStack as="ul" gap={0}>{noActivityRows.map(categoryItem)}</VStack>
              </VStack>
            </Section>
          ) : null}

          {showSupplementary ? (
            <Section variant="transparent" dividers={['top']}>
              <VStack gap={3}>
                <Heading level={2}>Income, transfers, and investments</Heading>
                <Text color="secondary">Financial activity is shown separately so it does not distort ordinary spending or budget health.</Text>
                <VStack as="ul" gap={0}>{financialRows.map(categoryItem)}</VStack>
              </VStack>
            </Section>
          ) : null}

        </VStack>
      </Page>
      <CategoryDialog isOpen={editorOpen} onOpenChange={setEditorOpen} category={editing} categories={state.categories} />
      <AlertDialog
        isOpen={Boolean(deleting)}
        onOpenChange={(open) => !open && !isDeleting && setDeleting(null)}
        title="Delete category?"
        description={deleting
          ? `${deleting.name} will be removed. ${linkedTransactionCount} linked ${linkedTransactionCount === 1 ? 'transaction' : 'transactions'} will move to Uncategorized and be marked for review.`
          : 'This category will be removed.'}
        actionLabel="Delete category"
        isActionLoading={isDeleting}
        onAction={async () => {
          if (!deleting) return;
          setIsDeleting(true);
          try {
            await deleteCategory(deleting.id);
            setDeleting(null);
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </>
  );
}

function CategoriesSkeleton() {
  return (
    <Page title="Categories" description="Loading category health, budgets, and transactions." contentWidth="calc(var(--spacing-12) * 27)">
      <VStack gap={5}>
        <Skeleton height="var(--spacing-12)" />
        <Skeleton height="calc(var(--spacing-12) * 4)" index={1} />
        <Skeleton height="calc(var(--spacing-12) * 8)" index={2} />
      </VStack>
    </Page>
  );
}

export default function CategoriesPage() {
  return <Suspense fallback={<CategoriesSkeleton />}><CategoriesContent /></Suspense>;
}
