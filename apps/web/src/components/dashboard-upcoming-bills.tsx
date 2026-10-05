import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

import {formatMinorCurrencySummary} from '@/lib/format';
import type {KosharaState} from '@/lib/koshara-types';
import {upcomingBills} from '@/lib/dashboard-personalization';

export function DashboardUpcomingBills({state, today}: {state: KosharaState; today: string}) {
  const bills = upcomingBills(state, today);
  return <Section><VStack gap={3}>
    <Heading level={2}>Upcoming bills</Heading>
    <Text type="supporting" color="secondary">Due in the next 30 days · {formatMinorCurrencySummary(bills.reduce((sum, bill) => sum + bill.amountMinor, 0), 'INR')} total</Text>
    {bills.length ? <VStack as="ul" gap={1}>{bills.map((bill) => <Item as="li" key={bill.id} label={bill.name} description={`${bill.dueDate} · ${formatMinorCurrencySummary(bill.amountMinor, 'INR')}`} density="balanced" />)}</VStack>
      : <EmptyState title="No upcoming bills" description="No scheduled demo bills are due in the next 30 days." headingLevel={3} />}
  </VStack></Section>;
}
