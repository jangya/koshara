'use client';

import {Button} from '@astryxdesign/core/Button';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {Selector} from '@astryxdesign/core/Selector';
import {HStack} from '@astryxdesign/core/Stack';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useState, type FormEvent} from 'react';

import {createAccount, updateAccount} from '@/lib/koshara-store';
import type {Account, AccountType} from '@/lib/koshara-types';

const accountTypeOptions = [
  {value: 'bank', label: 'Bank Account'},
  {value: 'credit-card', label: 'Credit Card'},
  {value: 'cash', label: 'Cash'},
  {value: 'wallet', label: 'Wallet'},
  {value: 'other', label: 'Other'},
];

function AccountForm({account, onClose}: {account: Account | null; onClose: () => void}) {
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank');
  const [institution, setInstitution] = useState(account?.institution ?? '');
  const [lastFour, setLastFour] = useState(account?.lastFour ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Enter an account name.');
      return;
    }
    if (lastFour && !/^\d{4}$/.test(lastFour)) {
      setError('Last four must contain exactly four digits.');
      return;
    }
    setSaving(true);
    try {
      const input = {name, type, institution, lastFour};
      if (account) await updateAccount(account.id, input);
      else await createAccount(input);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Layout
        header={<DialogHeader title={account ? 'Edit account' : 'Add account'} subtitle="Keep only the details needed to identify this account." onOpenChange={onClose} />}
        content={
          <LayoutContent padding={4}>
            <FormLayout>
              <TextInput label="Account name" value={name} onChange={setName} placeholder="HDFC Salary Account" isRequired status={error ? {type: 'error', message: error} : undefined} width="100%" />
              <Selector label="Account type" value={type} onChange={(value) => setType(value as AccountType)} options={accountTypeOptions} width="100%" />
              <TextInput label="Institution" value={institution} onChange={setInstitution} placeholder="HDFC Bank" isOptional width="100%" />
              <TextInput label="Last four digits" value={lastFour} onChange={setLastFour} placeholder="4821" isOptional width="100%" />
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter padding={3}>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onClose} isDisabled={saving} />
              <Button label={account ? 'Save changes' : 'Add account'} variant="primary" type="submit" isLoading={saving} />
            </HStack>
          </LayoutFooter>
        }
      />
    </form>
  );
}

export function AccountDialog({isOpen, onOpenChange, account}: {isOpen: boolean; onOpenChange: (open: boolean) => void; account: Account | null}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width="min(30rem, calc(100vw - var(--spacing-6)))">
      {isOpen ? <AccountForm key={account?.id ?? 'new'} account={account} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}
