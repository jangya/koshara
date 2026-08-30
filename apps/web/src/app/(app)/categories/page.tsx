'use client';

import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Button} from '@astryxdesign/core/Button';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Section} from '@astryxdesign/core/Section';
import {Selector} from '@astryxdesign/core/Selector';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {useState} from 'react';

import {CategoryDialog} from '@/components/category-dialog';
import {Page} from '@/components/page';
import {getBudgetStatus} from '@/lib/category-rules';
import {getDateRangePreset} from '@/lib/date-range';
import {formatMinorCurrencySummary} from '@/lib/format';
import {deleteCategory, useKosharaState} from '@/lib/koshara-store';
import type {Category} from '@/lib/koshara-types';

function currentMonthRange() {
  return getDateRangePreset('this-month');
}

export default function CategoriesPage() {
  const state = useKosharaState();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<'spending' | 'usage' | 'name'>('spending');
  const range = currentMonthRange();
  const expenses = state.transactions.filter((transaction) => transaction.kind === 'expense' && transaction.date >= range.start && transaction.date <= range.end);
  const rows = state.categories.map((category) => {
    const spendingMinor = expenses.filter((transaction) => transaction.categoryId === category.id)
      .reduce((total, transaction) => total + transaction.amountMinor, 0);
    return {category, spendingMinor};
  }).sort((a, b) => {
    if (sortBy === 'name') return a.category.name.localeCompare(b.category.name);
    if (sortBy === 'usage') {
      const aUsage = a.category.budgetMinor ? a.spendingMinor / a.category.budgetMinor : -1;
      const bUsage = b.category.budgetMinor ? b.spendingMinor / b.category.budgetMinor : -1;
      return bUsage - aUsage;
    }
    return b.spendingMinor - a.spendingMinor;
  });
  const linkedTransactionCount = deleting
    ? state.transactions.filter((transaction) => transaction.categoryId === deleting.id).length
    : 0;

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setEditorOpen(true);
  }

  return (
    <>
      <Page
        title="Categories"
        description="Review spending and manage the categories used across Koshara."
        actions={<Button label="Add category" variant="primary" onClick={openCreate} />}
      >
        <VStack gap={5}>
          <Section padding={0}>
            <VStack gap={0}>
            <HStack gap={3} padding={4} vAlign="center">
              <StackItem size="fill"><Heading level={2}>Monthly category view</Heading></StackItem>
              <Selector
                label="Sort categories"
                value={sortBy}
                onChange={(value) => setSortBy(value as typeof sortBy)}
                options={[
                  {value: 'spending', label: 'Highest spending'},
                  {value: 'usage', label: 'Budget usage'},
                  {value: 'name', label: 'Name'},
                ]}
                isLabelHidden
              />
              <Text type="supporting" color="secondary">{rows.length} categories</Text>
            </HStack>
            <VStack as="ul" gap={0}>
              {rows.map(({category, spendingMinor}) => {
                const budget = category.budgetMinor;
                const status = budget !== null ? getBudgetStatus(spendingMinor, budget) : null;
                return (
                  <Item
                    as="li"
                    key={category.id}
                    label={<HStack gap={2} vAlign="center"><Text>{category.name}</Text>{status ? <HStack gap={1} vAlign="center"><StatusDot label={status.label} variant={status.variant} /><Text type="supporting">{status.label}</Text></HStack> : null}</HStack>}
                    description={budget !== null ? (
                      <VStack gap={1}>
                        <Text type="supporting" color="secondary">{formatMinorCurrencySummary(spendingMinor, 'INR')} of {formatMinorCurrencySummary(budget, 'INR')} · {status?.percent}% used</Text>
                        <ProgressBar
                          label={`${category.name} monthly budget`}
                          value={Math.min(spendingMinor, budget)}
                          max={budget}
                          isLabelHidden
                          variant={status?.label === 'Over budget' ? 'warning' : 'accent'}
                        />
                      </VStack>
                    ) : <Text type="supporting" color="secondary">No monthly budget set</Text>}
                    endContent={
                      <HStack gap={1} vAlign="center">
                        <Text hasTabularNumbers>{formatMinorCurrencySummary(spendingMinor, 'INR')}</Text>
                        <Button label="Edit" variant="ghost" size="sm" onClick={() => openEdit(category)} />
                        <Button
                          label="Delete"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleting(category)}
                          isDisabled={category.id === 'uncategorized'}
                          tooltip={category.id === 'uncategorized' ? 'Required as the fallback category' : undefined}
                        />
                      </HStack>
                    }
                    align="start"
                    density={budget !== null ? 'spacious' : 'balanced'}
                  />
                );
              })}
            </VStack>
            </VStack>
          </Section>
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
