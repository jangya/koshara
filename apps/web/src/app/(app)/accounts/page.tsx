'use client';

import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {useState} from 'react';

import {AccountDialog} from '@/components/account-dialog';
import {Page} from '@/components/page';
import {deleteAccount, useKosharaState} from '@/lib/koshara-store';
import type {Account, AccountType} from '@/lib/koshara-types';

const accountTypeLabels: Record<AccountType, string> = {
  bank: 'Bank Account',
  'credit-card': 'Credit Card',
  cash: 'Cash',
  wallet: 'Wallet',
  other: 'Other',
};

function accountDescription(account: Account) {
  return [accountTypeLabels[account.type], account.institution, account.lastFour ? `•••• ${account.lastFour}` : null].filter(Boolean).join(' · ');
}

export default function AccountsPage() {
  const state = useKosharaState();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const linkedTransactionCount = deleting
    ? state.transactions.filter((transaction) => transaction.accountId === deleting.id).length
    : 0;

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setEditorOpen(true);
  }

  return (
    <>
      <Page
        title="Accounts"
        description="Accounts used to identify where each transaction belongs."
        actions={<Button label="Add account" variant="primary" onClick={openCreate} />}
      >
        <Section padding={0}>
          <VStack gap={0}>
            <HStack gap={3} padding={4} vAlign="center">
              <StackItem size="fill"><Heading level={2}>All accounts</Heading></StackItem>
              <Text type="supporting" color="secondary">{state.accounts.length} accounts</Text>
            </HStack>
            {state.accounts.length > 0 ? (
              <VStack as="ul" gap={0}>
                {state.accounts.map((account) => (
                  <Item
                    as="li"
                    key={account.id}
                    label={account.name}
                    description={accountDescription(account)}
                    endContent={
                      <HStack gap={1}>
                        <Button label="Edit" variant="ghost" size="sm" onClick={() => openEdit(account)} />
                        <Button label="Delete" variant="ghost" size="sm" onClick={() => setDeleting(account)} />
                      </HStack>
                    }
                    density="spacious"
                  />
                ))}
              </VStack>
            ) : (
              <Section variant="transparent" minHeight="20rem">
                <EmptyState
                  title="No accounts yet"
                  description="Add an account before recording a transaction."
                  actions={<Button label="Add account" variant="primary" onClick={openCreate} />}
                  headingLevel={2}
                />
              </Section>
            )}
          </VStack>
        </Section>
      </Page>
      <AccountDialog isOpen={editorOpen} onOpenChange={setEditorOpen} account={editing} />
      <AlertDialog
        isOpen={Boolean(deleting)}
        onOpenChange={(open) => !open && !isDeleting && setDeleting(null)}
        title="Delete account?"
        description={deleting
          ? `${deleting.name} and ${linkedTransactionCount} linked ${linkedTransactionCount === 1 ? 'transaction' : 'transactions'} will be removed from Koshara on this device.`
          : 'This account and its linked transactions will be removed.'}
        actionLabel="Delete account"
        isActionLoading={isDeleting}
        onAction={async () => {
          if (!deleting) return;
          setIsDeleting(true);
          try {
            await deleteAccount(deleting.id);
            setDeleting(null);
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </>
  );
}
