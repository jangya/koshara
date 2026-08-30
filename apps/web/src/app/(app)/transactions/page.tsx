'use client';

import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Section} from '@astryxdesign/core/Section';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Selector} from '@astryxdesign/core/Selector';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Toolbar} from '@astryxdesign/core/Toolbar';
import {useMemo, useState} from 'react';

import {Page} from '@/components/page';
import {TransactionDialog} from '@/components/transaction-dialog';
import {formatMinorCurrency, formatTransactionDate} from '@/lib/format';
import {deleteTransaction, useKosharaState} from '@/lib/koshara-store';
import type {Category, Transaction, TransactionKind} from '@/lib/koshara-types';

interface TransactionRow extends Record<string, unknown> {
  id: string;
  transaction: Transaction;
  date: string;
  description: string;
  account: string;
  category: string;
  amount: string;
}

type KindFilter = TransactionKind | 'all';
type ReviewFilter = 'all' | 'needs_review';

export default function TransactionsPage() {
  const state = useKosharaState();
  const [query, setQuery] = useState('');
  const [accountId, setAccountId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const accountName = useMemo(() => new Map(state.accounts.map((account) => [account.id, account.name])), [state.accounts]);
  const categoryById = useMemo(() => new Map(state.categories.map((category) => [category.id, category])), [state.categories]);
  const needsReviewCount = state.transactions.filter((transaction) => transaction.reviewStatus === 'needs_review').length;

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return [...state.transactions]
      .filter((transaction) => !normalized || `${transaction.description} ${transaction.notes}`.toLocaleLowerCase().includes(normalized))
      .filter((transaction) => accountId === 'all' || transaction.accountId === accountId)
      .filter((transaction) => categoryId === 'all' || transaction.categoryId === categoryId)
      .filter((transaction) => kind === 'all' || transaction.kind === kind)
      .filter((transaction) => reviewFilter === 'all' || transaction.reviewStatus === 'needs_review')
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [accountId, categoryId, kind, query, reviewFilter, state.transactions]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setEditorOpen(true);
  }

  function clearFilters() {
    setQuery('');
    setAccountId('all');
    setCategoryId('all');
    setKind('all');
    setReviewFilter('all');
  }

  const columns: TableColumn<TransactionRow>[] = [
    {key: 'date', header: 'Date', width: pixel(112)},
    {
      key: 'description',
      header: 'Description',
      width: proportional(2),
      renderCell: (row) => (
        <HStack gap={2} vAlign="center">
          <Text>{row.description}</Text>
          {row.transaction.reviewStatus === 'needs_review' ? <Badge label="Needs review" variant="warning" /> : null}
        </HStack>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: proportional(1),
      renderCell: (row) => {
        const category = categoryById.get(row.transaction.categoryId) as Category | undefined;
        return <Badge label={category?.name ?? 'Uncategorized'} variant={category?.color ?? 'neutral'} />;
      },
    },
    {key: 'account', header: 'Account', width: proportional(1)},
    {key: 'amount', header: 'Amount', width: pixel(136), align: 'end'},
    {
      key: 'transaction',
      header: 'Actions',
      width: pixel(156),
      align: 'end',
      renderCell: (row) => (
        <HStack gap={1} hAlign="end">
          <Button label="Edit" variant="ghost" size="sm" onClick={() => openEdit(row.transaction)} />
          <Button label="Delete" variant="ghost" size="sm" onClick={() => setDeleting(row.transaction)} />
        </HStack>
      ),
    },
  ];

  const rows: TransactionRow[] = visible.map((transaction) => ({
    id: transaction.id,
    transaction,
    date: formatTransactionDate(transaction.date),
    description: transaction.description,
    account: accountName.get(transaction.accountId) ?? 'Unknown account',
    category: categoryById.get(transaction.categoryId)?.name ?? 'Uncategorized',
    amount: `${transaction.kind === 'expense' ? '−' : '+'}${formatMinorCurrency(transaction.amountMinor, 'INR')}`,
  }));

  return (
    <>
      <Page
        title="Transactions"
        description="Search, filter, add, and correct household transactions."
        actions={<Button label="Add transaction" variant="primary" onClick={openCreate} />}
      >
        <Section padding={0}>
          <VStack gap={0}>
            <Toolbar
              label="Transaction filters"
              size="sm"
              startContent={
                <HStack gap={2} padding={3} wrap="wrap">
                  <TextInput label="Search transactions" value={query} onChange={setQuery} placeholder="Search transactions" isLabelHidden hasClear width={240} />
                  <SegmentedControl value={reviewFilter} onChange={(value) => setReviewFilter(value as ReviewFilter)} label="Review status" size="sm">
                    <SegmentedControlItem value="all" label="All" />
                    <SegmentedControlItem value="needs_review" label="Needs review" />
                  </SegmentedControl>
                  <Selector
                    label="Account"
                    value={accountId}
                    onChange={setAccountId}
                    options={[{value: 'all', label: 'All accounts'}, ...state.accounts.map((account) => ({value: account.id, label: account.name}))]}
                    isLabelHidden
                    width={180}
                  />
                  <Selector
                    label="Category"
                    value={categoryId}
                    onChange={setCategoryId}
                    options={[{value: 'all', label: 'All categories'}, ...state.categories.map((category) => ({value: category.id, label: category.name}))]}
                    isLabelHidden
                    width={180}
                  />
                  <Selector
                    label="Type"
                    value={kind}
                    onChange={(value) => setKind(value as KindFilter)}
                    options={[{value: 'all', label: 'All types'}, {value: 'expense', label: 'Expenses'}, {value: 'income', label: 'Income'}]}
                    isLabelHidden
                    width={132}
                  />
                  <Text type="supporting" color="secondary">{visible.length} transactions</Text>
                  {needsReviewCount > 0 ? <Text type="supporting" color="secondary">{needsReviewCount} need review</Text> : null}
                </HStack>
              }
            />
            {rows.length > 0 ? (
              <Table data={rows} columns={columns} idKey="id" density="compact" hasHover textOverflow="truncate" />
            ) : (
              <Section variant="transparent" minHeight="20rem">
                <EmptyState
                  title="No transactions found"
                  description="Try changing the filters or add a new transaction."
                  actions={<Button label="Clear filters" onClick={clearFilters} />}
                  headingLevel={2}
                />
              </Section>
            )}
          </VStack>
        </Section>
      </Page>

      <TransactionDialog
        isOpen={editorOpen}
        onOpenChange={setEditorOpen}
        transaction={editing}
        accounts={state.accounts}
        categories={state.categories}
      />
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
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </>
  );
}
