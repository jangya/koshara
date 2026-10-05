import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

import {formatMinorCurrencySummary} from '@/lib/format';
import type {HouseholdFinancialState} from '@/lib/dashboard-personalization';

export function DashboardSavingsOutlook({financial}: {financial: HouseholdFinancialState}) {
  return <Section><VStack gap={3}>
    <Heading level={2}>Savings outlook</Heading>
    <Text type="supporting" color="secondary">Cash flow margin for this period</Text>
    <Text type="display-3" hasTabularNumbers>{formatMinorCurrencySummary(financial.netCashFlowMinor, 'INR')}</Text>
    <Text>{financial.savingsRatePercent === null ? 'Add income transactions to see a margin.' : `${financial.savingsRatePercent}% of income remains after recorded outflows.`}</Text>
    <Text type="supporting" color="secondary">Based on recorded income and outflows; this is not an account balance or savings goal.</Text>
  </VStack></Section>;
}
