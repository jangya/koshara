'use client';

import type {ISODateString} from '@astryxdesign/core/Calendar';
import {Button} from '@astryxdesign/core/Button';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {HStack} from '@astryxdesign/core/Stack';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useState, type FormEvent} from 'react';

import {createTransaction, updateTransaction} from '@/lib/koshara-store';
import type {Account, Category, Transaction, TransactionKind} from '@/lib/koshara-types';

function today() {
  return new Date().toISOString().slice(0, 10) as ISODateString;
}

function TransactionForm({
  transaction,
  accounts,
  categories,
  onClose,
}: {
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
}) {
  const [date, setDate] = useState<ISODateString>((transaction?.date ?? today()) as ISODateString);
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [amount, setAmount] = useState<number | null>(transaction ? transaction.amountMinor / 100 : null);
  const [kind, setKind] = useState<TransactionKind>(transaction?.kind ?? 'expense');
  const [accountId, setAccountId] = useState(transaction?.accountId ?? accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? categories.find((category) => category.id !== 'income')?.id ?? '');
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError('');
    if (!description.trim() || !amount || amount <= 0 || !date || !accountId || !categoryId) return;
    const input = {
      date,
      description,
      amountMinor: Math.round(amount * 100),
      kind,
      accountId,
      categoryId,
      notes,
    };
    setSaving(true);
    try {
      if (transaction) await updateTransaction(transaction.id, {...input, reviewStatus: 'confirmed'});
      else await createTransaction({...input, source: 'manual'});
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the transaction.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Layout
        header={
          <DialogHeader
            title={transaction ? 'Edit transaction' : 'Add transaction'}
            subtitle={transaction ? 'Update the details saved in Koshara.' : 'Record an expense or income manually.'}
            onOpenChange={onClose}
          />
        }
        content={
          <LayoutContent padding={4}>
            <FormLayout>
              <FormLayout direction="horizontal">
                <DateInput label="Date" value={date} onChange={(value) => value && setDate(value)} isRequired width="100%" />
                <Selector
                  label="Type"
                  value={kind}
                  onChange={(value) => setKind(value as TransactionKind)}
                  options={[{value: 'expense', label: 'Expense'}, {value: 'income', label: 'Income'}]}
                  width="100%"
                />
              </FormLayout>
              <TextInput
                label="Description"
                value={description}
                onChange={setDescription}
                placeholder="Merchant or payment description"
                isRequired
                status={submitted && !description.trim()
                  ? {type: 'error', message: 'Enter a description.'}
                  : error ? {type: 'error', message: error} : undefined}
                width="100%"
              />
              <NumberInput
                label="Amount"
                value={amount}
                onChange={setAmount}
                min={0.01}
                step={0.01}
                units="₹"
                isRequired
                status={submitted && (!amount || amount <= 0) ? {type: 'error', message: 'Enter an amount greater than zero.'} : undefined}
                width="100%"
              />
              <FormLayout direction="horizontal">
                <Selector
                  label="Account"
                  value={accountId}
                  onChange={setAccountId}
                  options={accounts.map((account) => ({value: account.id, label: [account.name, account.institution, account.lastFour ? `•••• ${account.lastFour}` : null].filter(Boolean).join(' · ')}))}
                  isRequired
                  width="100%"
                />
                <Selector
                  label="Category"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={categories.map((category) => ({value: category.id, label: category.name}))}
                  isRequired
                  hasSearch
                  width="100%"
                />
              </FormLayout>
              <TextArea label="Notes" value={notes} onChange={setNotes} placeholder="Optional notes" isOptional width="100%" />
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter padding={3}>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onClose} isDisabled={saving} />
              <Button label={transaction ? 'Save changes' : 'Add transaction'} variant="primary" type="submit" isLoading={saving} />
            </HStack>
          </LayoutFooter>
        }
      />
    </form>
  );
}

export function TransactionDialog({
  isOpen,
  onOpenChange,
  transaction,
  accounts,
  categories,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width="min(34rem, calc(100vw - var(--spacing-6)))">
      {isOpen ? (
        <TransactionForm
          key={transaction?.id ?? 'new'}
          transaction={transaction}
          accounts={accounts}
          categories={categories}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}
