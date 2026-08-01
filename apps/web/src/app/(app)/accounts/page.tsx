import {Divider} from '@astryxdesign/core/Divider';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {listFinancialAccounts, listPeople} from '@koshara/database';
import type {Metadata} from 'next';

import {AccountForm} from '@/components/forms/account-form';
import {PersonForm} from '@/components/forms/person-form';
import {Page} from '@/components/page';
import {getDatabase} from '@/lib/database';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Accounts'};

export default async function AccountsPage() {
  const context = await getHouseholdPageContext();
  const [people, accounts] = await Promise.all([
    listPeople(getDatabase(), context.householdId),
    listFinancialAccounts(getDatabase(), context.householdId),
  ]);

  return (
    <Page title="Accounts" description="Track personal and joint accounts without storing complete account numbers.">
      <VStack gap={6}>
        <Section>
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>Household people</Heading>
              <Text color="secondary">People may be signed-in members, dependents, or anyone whose expenses are tracked.</Text>
            </VStack>
            <VStack as="ul" gap={0}>
              {people.map((person) => (
                <Item
                  as="li"
                  key={person.id}
                  label={person.displayName}
                  description={person.linkedClerkUserId ? 'Linked household member' : person.type}
                  density="balanced"
                />
              ))}
            </VStack>
            <Divider />
            <PersonForm />
          </VStack>
        </Section>
        <Section>
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>Financial accounts</Heading>
              <Text color="secondary">Only names, currency, ownership and optional masked references are stored.</Text>
            </VStack>
            {accounts.length > 0 ? (
              <VStack as="ul" gap={0}>
                {accounts.map((account) => (
                  <Item
                    as="li"
                    key={account.id}
                    label={account.displayName}
                    description={`${account.institutionName} · ${account.accountType} · ${account.currency}`}
                    endContent={account.joint ? 'Joint' : 'Personal'}
                    density="balanced"
                  />
                ))}
              </VStack>
            ) : (
              <Text color="secondary">No financial accounts have been added.</Text>
            )}
            <Divider />
            <AccountForm people={people.map(({id, displayName}) => ({id, displayName}))} />
          </VStack>
        </Section>
      </VStack>
    </Page>
  );
}
