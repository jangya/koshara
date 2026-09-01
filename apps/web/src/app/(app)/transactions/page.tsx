'use client';

import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Pagination} from '@astryxdesign/core/Pagination';
import {Section} from '@astryxdesign/core/Section';
import {Selector} from '@astryxdesign/core/Selector';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {
  Table,
  pixel,
  proportional,
  useTableSelection,
  useTableSelectionState,
  useTableSortable,
  type TableColumn,
} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Toolbar} from '@astryxdesign/core/Toolbar';
import {useSearchParams} from 'next/navigation';
import {Suspense, useEffect, useMemo, useState} from 'react';

import {DateRangeControl, useDateRangeSearchParams} from '@/components/date-range-control';
import {Page} from '@/components/page';
import {TransactionDialog} from '@/components/transaction-dialog';
import {formatDateRange, getDateRangePreset, isInDateRange} from '@/lib/date-range';
import {formatMinorCurrencySummary, formatTransactionDate} from '@/lib/format';
import {deleteTransaction, updateTransaction, updateTransactions, useKosharaState} from '@/lib/koshara-store';
import type {Category, Transaction} from '@/lib/koshara-types';
import {
  filterAndSortTransactions,
  parseTransactionViewParams,
  type TransactionSortKey,
} from '@/lib/transaction-view';

interface TransactionRow extends Record<string, unknown> {
  id: string;
  transaction: Transaction;
  date: string;
  description: string;
  account: string;
  category: string;
  amount: string;
}

type BulkAction = {type: 'category'; categoryId: string} | null;

function TransactionsContent() {
  const state = useKosharaState();
  const searchParams = useSearchParams();
  const {range, preset, setRange, replaceParams} = useDateRangeSearchParams();
  const view = useMemo(() => parseTransactionViewParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkAction>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const accountName = useMemo(() => new Map(state.accounts.map((account) => [account.id, account.name])), [state.accounts]);
  const categoryById = useMemo(() => new Map(state.categories.map((category) => [category.id, category])), [state.categories]);
  const needsReviewCount = state.transactions.filter(
    (transaction) => transaction.reviewStatus === 'needs_review' && isInDateRange(transaction.date, range),
  ).length;

  const visible = useMemo(() => filterAndSortTransactions(state.transactions, {
    range,
    query: view.query,
    accountId: view.accountId,
    categoryId: view.categoryId,
    kind: view.kind,
    reviewStatus: view.reviewStatus,
    sortBy: view.sortBy,
    sortDirection: view.sortDirection,
  }), [range, state.transactions, view.accountId, view.categoryId, view.kind, view.query, view.reviewStatus, view.sortBy, view.sortDirection]);
  const totalPages = Math.max(1, Math.ceil(visible.length / view.pageSize));
  const currentPage = Math.min(view.page, totalPages);
  const pageStart = (currentPage - 1) * view.pageSize;
  const pageTransactions = visible.slice(pageStart, pageStart + view.pageSize);

  useEffect(() => {
    if (view.page <= totalPages) return;
    replaceParams((params) => params.set('page', String(totalPages)));
  }, [replaceParams, totalPages, view.page]);

  function setParam(key: string, value: string, defaultValue = 'all') {
    replaceParams((params) => {
      if (!value || value === defaultValue) params.delete(key);
      else params.set(key, value);
      params.delete('page');
    });
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setEditorOpen(true);
  }

  function resetFilters() {
    const current = getDateRangePreset('this-month');
    replaceParams((params) => {
      ['q', 'account', 'category', 'type', 'review', 'sort', 'direction', 'page', 'pageSize'].forEach((key) => params.delete(key));
      params.set('from', current.start);
      params.set('to', current.end);
      params.set('range', 'this-month');
    });
    setSelectedKeys(new Set());
  }

  async function confirmReviewed() {
    if (selectedKeys.size === 0) return;
    setMutationError('');
    setIsBulkUpdating(true);
    try {
      await updateTransactions([...selectedKeys], {reviewStatus: 'confirmed'});
      setSelectedKeys(new Set());
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Could not update the selected transactions.');
    } finally {
      setIsBulkUpdating(false);
    }
  }

  const rows: TransactionRow[] = pageTransactions.map((transaction) => ({
    id: transaction.id,
    transaction,
    date: formatTransactionDate(transaction.date),
    description: transaction.description,
    account: accountName.get(transaction.accountId) ?? 'Unknown account',
    category: categoryById.get(transaction.categoryId)?.name ?? 'Uncategorized',
    amount: `${transaction.kind === 'expense' ? '−' : '+'}${formatMinorCurrencySummary(transaction.amountMinor, 'INR')}`,
  }));

  const columns: TableColumn<TransactionRow>[] = [
    {key: 'date', header: 'Date', width: pixel(112), sortable: true},
    {
      key: 'description',
      header: 'Description and details',
      width: proportional(2),
      renderCell: (row) => (
        <VStack gap={0}>
          <HStack gap={2} vAlign="center">
            <Text>{row.description}</Text>
            {row.transaction.reviewStatus === 'needs_review' ? <Badge label="Needs review" variant="warning" /> : null}
          </HStack>
          <Text type="supporting" color="secondary" maxLines={1}>
            {row.transaction.source === 'agent' ? 'AI agent' : row.transaction.source === 'demo' ? 'Demo data' : 'Manual'}
            {row.transaction.confidence !== undefined ? ` · ${Math.round(row.transaction.confidence * 100)}% confidence` : ''}
            {row.transaction.notes ? ` · ${row.transaction.notes}` : ' · No notes'}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: proportional(1),
      renderCell: (row) => {
        const category = categoryById.get(row.transaction.categoryId) as Category | undefined;
        return row.transaction.reviewStatus === 'needs_review' ? (
          <Selector
            label={`Category for ${row.transaction.description}`}
            value={row.transaction.categoryId}
            onChange={(value) => {
              setMutationError('');
              void updateTransaction(row.transaction.id, {categoryId: value}).catch((error: unknown) => {
                setMutationError(error instanceof Error ? error.message : 'Could not update the category.');
              });
            }}
            options={state.categories.map(({id, name}) => ({value: id, label: name}))}
            isLabelHidden
          />
        ) : <Badge label={category?.name ?? 'Uncategorized'} variant={category?.color ?? 'neutral'} />;
      },
    },
    {key: 'account', header: 'Account', width: proportional(1)},
    {
      key: 'amount',
      header: 'Amount',
      width: pixel(136),
      align: 'end',
      sortable: true,
      renderCell: (row) => <Text hasTabularNumbers justify="end">{row.amount}</Text>,
    },
    {
      key: 'transaction',
      header: 'Actions',
      width: pixel(156),
      align: 'end',
      renderCell: (row) => (
        <HStack gap={1} hAlign="end">
          <Button label="Edit" variant="ghost" onClick={() => openEdit(row.transaction)} />
          <Button label="Delete" variant="ghost" onClick={() => setDeleting(row.transaction)} />
        </HStack>
      ),
    },
  ];

  const {selectionConfig} = useTableSelectionState({
    data: rows,
    idKey: 'id',
    selectedKeys,
    setSelectedKeys,
  });
  const selectionPlugin = useTableSelection({...selectionConfig, getRowLabel: (row) => row.description});
  const sortablePlugin = useTableSortable<TransactionRow>({
    sort: [{sortKey: view.sortBy, direction: view.sortDirection}],
    onSortChange: (sort) => {
      const next = sort[0];
      if (!next || (next.sortKey !== 'date' && next.sortKey !== 'amount')) return;
      replaceParams((params) => {
        params.set('sort', next.sortKey as TransactionSortKey);
        params.set('direction', next.direction === 'ascending' ? 'asc' : 'desc');
        params.delete('page');
      });
    },
  });
  const activeFilterCount = [
    view.query,
    view.accountId !== 'all',
    view.categoryId !== 'all',
    view.kind !== 'all',
    view.reviewStatus !== 'all',
    preset !== 'this-month',
  ].filter(Boolean).length;
  const period = formatDateRange(range);

  return (
    <>
      <Page
        title="Transactions"
        description="Search, review, sort, and correct household transactions at scale."
        actions={<Button label="Add transaction" variant="primary" onClick={openCreate} />}
      >
        <VStack gap={5}>
          <DateRangeControl range={range} preset={preset} onChange={setRange} />
          {needsReviewCount > 0 ? (
            <Banner
              status="warning"
              title={`${needsReviewCount} ${needsReviewCount === 1 ? 'transaction needs' : 'transactions need'} review`}
              description={`Review uncertain transactions from ${period} and confirm them in bulk.`}
              endContent={<Button label="Review now" variant="secondary" onClick={() => setParam('review', 'needs_review')} />}
            />
          ) : null}
          {mutationError ? <Banner status="error" title="Transaction update failed" description={mutationError} /> : null}

          <Section padding={0} className="transactions-table">
            <VStack gap={0}>
              <Toolbar
                label="Transaction filters"
                size="sm"
                startContent={
                  <HStack gap={2} padding={3} wrap="wrap">
                    <TextInput label="Search transactions" value={view.query} onChange={(value) => setParam('q', value, '')} placeholder="Search transactions" isLabelHidden hasClear />
                    <Selector
                      label="Review status"
                      value={view.reviewStatus}
                      onChange={(value) => setParam('review', value)}
                      options={[{value: 'all', label: 'All review states'}, {value: 'needs_review', label: 'Needs review'}]}
                      isLabelHidden
                    />
                    <Selector label="Account" value={view.accountId} onChange={(value) => setParam('account', value)} options={[{value: 'all', label: 'All accounts'}, ...state.accounts.map((account) => ({value: account.id, label: account.name}))]} isLabelHidden />
                    <Selector label="Category" value={view.categoryId} onChange={(value) => setParam('category', value)} options={[{value: 'all', label: 'All categories'}, ...state.categories.map((category) => ({value: category.id, label: category.name}))]} isLabelHidden />
                    <Selector label="Type" value={view.kind} onChange={(value) => setParam('type', value)} options={[{value: 'all', label: 'All types'}, {value: 'expense', label: 'Expenses'}, {value: 'income', label: 'Income'}]} isLabelHidden />
                    <Badge label={`${activeFilterCount} active`} variant="neutral" />
                    <Button label="Reset filters" variant="ghost" onClick={resetFilters} isDisabled={activeFilterCount === 0} />
                  </HStack>
                }
              />
              {selectedKeys.size > 0 ? (
                <Toolbar
                  label="Bulk transaction actions"
                  size="sm"
                  variant="muted"
                  startContent={
                    <HStack gap={2} padding={3} wrap="wrap" vAlign="center">
                      <Badge label={`${selectedKeys.size} selected`} />
                      <Selector
                        label="Bulk category"
                        value={bulkCategoryId}
                        onChange={setBulkCategoryId}
                        options={[{value: '', label: 'Choose category'}, ...state.categories.map(({id, name}) => ({value: id, label: name}))]}
                        isLabelHidden
                      />
                      <Button label="Assign category" variant="secondary" onClick={() => bulkCategoryId && setPendingBulkAction({type: 'category', categoryId: bulkCategoryId})} isDisabled={!bulkCategoryId || isBulkUpdating} />
                      <Button label="Confirm reviewed" variant="secondary" onClick={() => void confirmReviewed()} isLoading={isBulkUpdating} />
                    </HStack>
                  }
                  endContent={<Button label="Deselect all" variant="ghost" onClick={() => setSelectedKeys(new Set())} />}
                />
              ) : null}
              {rows.length > 0 ? (
                <>
                  <Table
                    data={rows}
                    columns={columns}
                    idKey="id"
                    density="compact"
                    hasHover
                    textOverflow="truncate"
                    plugins={{selection: selectionPlugin, sortable: sortablePlugin}}
                    rowIndexStart={pageStart + 1}
                    rowCount={visible.length}
                  />
                  <HStack padding={3} vAlign="center">
                    <StackItem size="fill"><Text type="supporting" color="secondary">{visible.length} transactions · {period}</Text></StackItem>
                    <Pagination
                      page={currentPage}
                      onChange={(page) => setParam('page', String(page), '1')}
                      totalItems={visible.length}
                      pageSize={view.pageSize}
                      pageSizeOptions={[10, 20, 50, 100]}
                      onPageSizeChange={(pageSize) => setParam('pageSize', String(pageSize), '20')}
                      variant="count"
                      size="sm"
                      label="Transaction pages"
                    />
                  </HStack>
                </>
              ) : (
                <Section variant="transparent" minHeight="20rem">
                  <EmptyState
                    title="No transactions found"
                    description="Try changing the active filters or add a new transaction."
                    actions={<Button label="Reset filters" onClick={resetFilters} />}
                    headingLevel={2}
                  />
                </Section>
              )}
            </VStack>
          </Section>

        </VStack>
      </Page>

      <TransactionDialog isOpen={editorOpen} onOpenChange={setEditorOpen} transaction={editing} accounts={state.accounts} categories={state.categories} />
      <AlertDialog
        isOpen={Boolean(deleting)}
        onOpenChange={(open) => !open && !isDeleting && setDeleting(null)}
        title="Delete transaction?"
        description={deleting ? `${deleting.description} will be removed from Koshara on this device.` : 'This transaction will be removed.'}
        actionLabel="Delete transaction"
        isActionLoading={isDeleting}
        onAction={async () => {
          if (!deleting) return;
          setIsDeleting(true);
          try {
            await deleteTransaction(deleting.id);
            setDeleting(null);
            setSelectedKeys((selected) => {
              const next = new Set(selected);
              next.delete(deleting.id);
              return next;
            });
          } finally {
            setIsDeleting(false);
          }
        }}
      />
      <AlertDialog
        isOpen={Boolean(pendingBulkAction)}
        onOpenChange={(open) => !open && !isBulkUpdating && setPendingBulkAction(null)}
        title="Assign category to selected transactions?"
        description={pendingBulkAction ? `This will replace the category on ${selectedKeys.size} selected transactions with ${categoryById.get(pendingBulkAction.categoryId)?.name ?? 'the chosen category'}.` : 'The selected transactions will be updated.'}
        actionLabel="Assign category"
        actionVariant="primary"
        isActionLoading={isBulkUpdating}
        onAction={async () => {
          if (!pendingBulkAction) return;
          setIsBulkUpdating(true);
          setMutationError('');
          try {
            await updateTransactions([...selectedKeys], {categoryId: pendingBulkAction.categoryId});
            setSelectedKeys(new Set());
            setPendingBulkAction(null);
          } catch (error) {
            setMutationError(error instanceof Error ? error.message : 'Could not assign the category.');
          } finally {
            setIsBulkUpdating(false);
          }
        }}
      />
    </>
  );
}

function TransactionsSkeleton() {
  return (
    <Page title="Transactions" description="Loading household transactions and filters.">
      <VStack gap={5}>
        <Skeleton height="var(--spacing-12)" />
        <Skeleton height="calc(var(--spacing-12) * 8)" index={1} />
      </VStack>
    </Page>
  );
}

export default function TransactionsPage() {
  return <Suspense fallback={<TransactionsSkeleton />}><TransactionsContent /></Suspense>;
}
