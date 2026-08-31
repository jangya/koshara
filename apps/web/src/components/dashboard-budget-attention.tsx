import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Token, type TokenColor} from '@astryxdesign/core/Token';

import type {DashboardBudgetAttention as BudgetAttentionItem} from '@/lib/dashboard-insights';
import {formatMinorCurrencySummary} from '@/lib/format';

function attentionColor(reason: BudgetAttentionItem['reason']): TokenColor {
  if (reason === 'Over budget') return 'red';
  if (reason === 'Near limit') return 'orange';
  return 'blue';
}

function budgetDescription({row, reason}: BudgetAttentionItem) {
  const limit = row.budgetLimitMinor;
  if (limit === null) {
    return `${reason}; no monthly limit set`;
  }
  const difference = limit - row.spendingMinor;
  const differenceLabel = difference < 0
    ? `${formatMinorCurrencySummary(Math.abs(difference), 'INR')} over`
    : `${formatMinorCurrencySummary(difference, 'INR')} remaining`;
  return `${formatMinorCurrencySummary(row.spendingMinor, 'INR')} of ${formatMinorCurrencySummary(limit, 'INR')} · ${differenceLabel}`;
}

export function DashboardBudgetAttention({items, period}: {items: BudgetAttentionItem[]; period: string}) {
  return (
    <Section height="100%">
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>Budget attention</Heading>
          <Text type="supporting" color="secondary">Rules-based signals for {period}</Text>
        </VStack>
        {items.length > 0 ? (
          <VStack as="ul" gap={1}>
            {items.map((item) => (
              <Item
                as="li"
                key={item.row.category.id}
                label={
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <StackItem size="fill"><Text>{item.row.category.name}</Text></StackItem>
                    <Token label={item.reason} color={attentionColor(item.reason)} size="sm" />
                  </HStack>
                }
                description={budgetDescription(item)}
                align="start"
                density="balanced"
              />
            ))}
          </VStack>
        ) : (
          <EmptyState
            title="Budgets look steady"
            description="No category is near its limit, over budget, or unusually higher than the previous period."
            headingLevel={3}
          />
        )}
      </VStack>
    </Section>
  );
}
