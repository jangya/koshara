import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

import {formatMinorCurrencySummary} from '@/lib/format';
import type {Account} from '@/lib/koshara-types';

function accountType(type: Account['type']) {
  if (type === 'credit-card') return 'Credit card';
  return type.charAt(0).toLocaleUpperCase() + type.slice(1);
}

export function DashboardAccounts({accounts}: {accounts: Account[]}) {
  return (
    <Section height="100%">
      <VStack gap={4}>
        <Heading level={2}>Accounts</Heading>
        <VStack as="ul" gap={0}>
          {accounts.map((account) => (
            <Item
              as="li"
              key={account.id}
              label={account.name}
              labelLines={2}
              description={[
                account.institution,
                accountType(account.type),
                account.lastFour ? `•••• ${account.lastFour}` : null,
              ].filter(Boolean).join(' · ')}
              endContent={
                <VStack gap={0} hAlign="end">
                  <Text hasTabularNumbers justify="end">{formatMinorCurrencySummary(account.balanceMinor, 'INR')}</Text>
                  <Text type="supporting" color="secondary" justify="end">
                    {account.type === 'credit-card' ? 'Outstanding' : 'Current balance'}
                  </Text>
                </VStack>
              }
              density="spacious"
              align="start"
            />
          ))}
        </VStack>
      </VStack>
    </Section>
  );
}
