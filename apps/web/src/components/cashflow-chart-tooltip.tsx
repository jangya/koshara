import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import type {TooltipContentProps} from 'recharts';

import type {CashflowChartMode, CashflowChartPoint} from '@/lib/cashflow-chart';
import {formatMinorCurrencySummary} from '@/lib/format';

function TooltipRow({label, value}: {label: string; value: number}) {
  return (
    <HStack gap={4} vAlign="center">
      <StackItem size="fill"><Text>{label}</Text></StackItem>
      <Text hasTabularNumbers>{formatMinorCurrencySummary(value, 'INR')}</Text>
    </HStack>
  );
}

export function CashFlowTooltip({
  active,
  payload,
  mode,
  comparePreviousPeriod,
  previousPeriod,
  hasHighlightedCategories,
}: TooltipContentProps & {
  mode: CashflowChartMode;
  comparePreviousPeriod: boolean;
  previousPeriod: string;
  hasHighlightedCategories: boolean;
}) {
  const point = payload[0]?.payload as CashflowChartPoint | undefined;
  if (!active || !point) return null;
  const showsIncome = mode !== 'spending';
  const showsSpending = mode !== 'income';

  return (
    <Section padding={3} variant="muted">
      <VStack gap={2} minHeight="var(--spacing-12)">
        <Text type="supporting" color="secondary">{point.label}</Text>
        {showsIncome ? <TooltipRow label="Income" value={point.incomeMinor} /> : null}
        {showsSpending ? <TooltipRow label="Spending" value={point.spendingMinor} /> : null}
        {showsSpending && hasHighlightedCategories ? <TooltipRow label="Highlighted categories" value={point.highlightedSpendingMinor} /> : null}
        {comparePreviousPeriod ? (
          <VStack gap={2}>
            <Text type="supporting" color="secondary">Previous period · {point.previousLabel ?? previousPeriod}</Text>
            {showsIncome ? <TooltipRow label="Income" value={point.previousIncomeMinor ?? 0} /> : null}
            {showsSpending ? <TooltipRow label="Spending" value={point.previousSpendingMinor ?? 0} /> : null}
          </VStack>
        ) : null}
      </VStack>
    </Section>
  );
}
