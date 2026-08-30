'use client';

import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {useState} from 'react';

import {CategoryDialog} from '@/components/category-dialog';
import {Page} from '@/components/page';
import {formatMinorCurrency} from '@/lib/format';
import {deleteCategory, useKosharaState} from '@/lib/koshara-store';
import type {Category} from '@/lib/koshara-types';

function currentMonthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 12).toISOString().slice(0, 10),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 12).toISOString().slice(0, 10),
  };
}

export default function CategoriesPage() {
  const state = useKosharaState();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const range = currentMonthRange();
  const expenses = state.transactions.filter((transaction) => transaction.kind === 'expense' && transaction.date >= range.start && transaction.date <= range.end);
  const rows = state.categories.map((category) => {
    const spendingMinor = expenses.filter((transaction) => transaction.categoryId === category.id)
      .reduce((total, transaction) => total + transaction.amountMinor, 0);
    return {category, spendingMinor};
  }).sort((a, b) => b.spendingMinor - a.spendingMinor);
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
        <Section padding={0}>
          <VStack gap={0}>
            <HStack gap={3} padding={4} vAlign="center">
              <StackItem size="fill"><Heading level={2}>Monthly category view</Heading></StackItem>
              <Text type="supporting" color="secondary">{rows.length} categories</Text>
            </HStack>
            <VStack as="ul" gap={0}>
              {rows.map(({category, spendingMinor}) => {
                const budget = category.budgetMinor;
                const overBudget = budget !== null && spendingMinor > budget;
                return (
                  <Item
                    as="li"
                    key={category.id}
                    label={<HStack gap={2} vAlign="center"><Text>{category.name}</Text>{overBudget ? <Badge label="Over budget" variant="warning" /> : null}</HStack>}
                    description={budget ? (
                      <VStack gap={1}>
                        <Text type="supporting" color="secondary">{formatMinorCurrency(spendingMinor, 'INR')} of {formatMinorCurrency(budget, 'INR')}</Text>
                        <ProgressBar
                          label={`${category.name} monthly budget`}
                          value={Math.min(spendingMinor, budget)}
                          max={budget}
                          isLabelHidden
                          variant={overBudget ? 'warning' : 'accent'}
                        />
                      </VStack>
                    ) : <Text type="supporting" color="secondary">No monthly budget set</Text>}
                    endContent={
                      <HStack gap={1} vAlign="center">
                        <Text>{formatMinorCurrency(spendingMinor, 'INR')}</Text>
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
                    density="spacious"
                  />
                );
              })}
            </VStack>
          </VStack>
        </Section>
      </Page>
      <CategoryDialog isOpen={editorOpen} onOpenChange={setEditorOpen} category={editing} />
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
