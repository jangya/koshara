'use client';

import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {Selector} from '@astryxdesign/core/Selector';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {useState} from 'react';

import {PdfStatementImport} from '@/components/pdf-statement-import';
import {AccountForm} from '@/components/account-dialog';
import {CategoryForm} from '@/components/category-dialog';
import {TransactionForm} from '@/components/transaction-dialog';
import {approveStatementImport, updateStatementImportItem, useKosharaState} from '@/lib/koshara-store';
import {formatMinorCurrencySummary, formatTransactionDate} from '@/lib/format';
import type {WorkspaceSurfaceProps} from './intents/types';
import {parseExpense} from './intents/parse-expense';
import {WorkspaceWidgetCollection} from './widgets/collection';
import {parseWidgetRequest} from './widgets/parse-widget-request';

export function ExpenseSurface({input, onComplete}: WorkspaceSurfaceProps) {
  const {accounts, categories} = useKosharaState();
  return <Section><TransactionForm transaction={null} accounts={accounts} categories={categories} inline expenseOnly
    initialExpense={parseExpense(input, categories)} onClose={() => onComplete()}
    onSaved={(transaction) => onComplete({title: 'Expense added', detail: `${formatMinorCurrencySummary(transaction.amountMinor, 'INR')} · ${transaction.description} · ${formatTransactionDate(transaction.date)}`})} /></Section>;
}

export function StatementSurface({onComplete}: WorkspaceSurfaceProps) {
  const {accounts, categories, importSessions} = useKosharaState();
  const session = importSessions.find(({status}) => status === 'ready_for_review') ?? null;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const readyCount = session?.items.filter((item) => item.status === 'ready' && item.included).length ?? 0;

  async function approve() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const result = await approveStatementImport(session.id);
      onComplete({title: 'Statement imported', detail: `${result.transactions.length} transactions added from ${session.sourceName}.`});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The import could not be approved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <VStack gap={4}>
      <PdfStatementImport accounts={accounts} activeSession={session} />
      {session ? <Section>
        <VStack gap={3}>
          <Heading level={2}>Review statement</Heading>
          <Text color="secondary">Check each row. Only ready rows are added when you approve the import.</Text>
          <VStack as="ul" gap={0}>
            {session.items.map((item) => <Item as="li" key={item.id} label={item.description}
              description={<HStack gap={2} wrap="wrap" vAlign="end">
                <Selector label="Category" value={item.proposedCategoryId} size="sm"
                  options={categories.map(({id, name}) => ({value: id, label: name}))}
                  onChange={(value) => void updateStatementImportItem(session.id, item.id, {proposedCategoryId: value}).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not update category.'))} />
                <Text type="supporting" color="secondary">{item.status.replaceAll('_', ' ')}</Text>
              </HStack>}
              endContent={item.status === 'needs_attention'
                ? <Button label="Move to Ready" size="sm" isDisabled={item.proposedCategoryId === 'uncategorized'}
                    onClick={() => void updateStatementImportItem(session.id, item.id, {approve: true}).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not approve row.'))} />
                : null} />)}
          </VStack>
          {error ? <Banner status="error" title="Import needs attention" description={error} /> : null}
          <HStack gap={2} hAlign="end"><Button label={`Approve import (${readyCount})`} variant="primary" isDisabled={!readyCount || busy} isLoading={busy} onClick={() => void approve()} /></HStack>
        </VStack>
      </Section> : null}
    </VStack>
  );
}

export function AccountSurface({onComplete}: WorkspaceSurfaceProps) {
  return <AccountForm account={null} inline embedded onClose={() => onComplete()}
    onSaved={(account) => onComplete({title: 'Account added', detail: `${account.name} added to your accounts.`})} />;
}

export function CategorySurface({onComplete}: WorkspaceSurfaceProps) {
  const {categories} = useKosharaState();
  return <CategoryForm category={null} categories={categories} inline embedded onClose={() => onComplete()}
    onSaved={(category) => onComplete({title: 'Category added', detail: `${category.name} added to your categories.`})} />;
}

export function AccountsSurface() {
  const {accounts} = useKosharaState();
  return <VStack gap={2}><Heading level={2}>Accounts</Heading><Text color="secondary">{accounts.length} accounts</Text>
    <VStack as="ul" gap={0}>{accounts.map((account) => <Item as="li" key={account.id} label={account.name}
      description={account.institution || account.type} endContent={<Text hasTabularNumbers>{formatMinorCurrencySummary(account.balanceMinor, 'INR')}</Text>} />)}</VStack>
  </VStack>;
}

export function TransactionsSurface({expensesOnly = false}: WorkspaceSurfaceProps & {expensesOnly?: boolean}) {
  const {transactions, accounts, categories} = useKosharaState();
  const filtered = expensesOnly ? transactions.filter(({kind}) => kind === 'expense') : transactions;
  return <VStack gap={2}><Heading level={2}>{expensesOnly ? 'Expenses' : 'Transactions'}</Heading>
    <Text color="secondary">{filtered.length} {expensesOnly ? 'expenses' : 'transactions'} · showing the latest {Math.min(filtered.length, 20)}</Text>
    <VStack as="ul" gap={0}>{filtered.slice(0, 20).map((transaction) => <Item as="li" key={transaction.id}
      label={transaction.description}
      description={`${formatTransactionDate(transaction.date)} · ${categories.find(({id}) => id === transaction.categoryId)?.name ?? 'Uncategorized'} · ${accounts.find(({id}) => id === transaction.accountId)?.name ?? 'Account'}`}
      endContent={<Text hasTabularNumbers>{transaction.kind === 'expense' ? '−' : '+'}{formatMinorCurrencySummary(transaction.amountMinor, 'INR')}</Text>} />)}</VStack>
  </VStack>;
}

export function ExpensesSurface(props: WorkspaceSurfaceProps) { return <TransactionsSurface {...props} expensesOnly />; }

export function WidgetSurface({input}: WorkspaceSurfaceProps) {
  return <WorkspaceWidgetCollection request={parseWidgetRequest(input)} />;
}

export function DashboardBuilderSurface() {
  return <VStack gap={3}><Heading level={2}>Build dashboard</Heading><Text color="secondary">Create an empty dashboard, add the finance widgets you need, then save it.</Text><Link href="/dashboard?new=1" isStandalone>Create new dashboard</Link></VStack>;
}
