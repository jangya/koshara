import {Button} from '@astryxdesign/core/Button';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';
import {Token} from '@astryxdesign/core/Token';

import type {CashflowChartConfiguration} from '@/lib/cashflow-chart';
import {formatTransactionDate} from '@/lib/format';

export function CashflowChartAgentState({
  configuration,
  accountNames,
  categoryNames,
  highlightedCategoryNames,
  previousPeriod,
  onReset,
}: {
  configuration: CashflowChartConfiguration;
  accountNames: string[];
  categoryNames: string[];
  highlightedCategoryNames: string[];
  previousPeriod: string;
  onReset: () => void;
}) {
  return (
    <VStack gap={2}>
      <HStack className="dashboard-agent-chart-update" gap={2} vAlign="center" wrap="wrap" role="status" aria-live="polite">
        <StatusDot variant="accent" label="Chart updated by your agent" />
        <StackItem size="fill"><Text type="supporting" color="secondary">Updated by your agent</Text></StackItem>
        <Button label="Reset chart" variant="ghost" size="sm" onClick={onReset} />
      </HStack>
      <HStack gap={2} wrap="wrap" aria-label="Agent-applied chart context">
        {configuration.comparePreviousPeriod ? <Token label={`Comparing ${previousPeriod}`} size="sm" color="blue" /> : null}
        {accountNames.map((name) => <Token key={`account-${name}`} label={`Account: ${name}`} size="sm" color="gray" />)}
        {categoryNames.map((name) => <Token key={`category-${name}`} label={`Filter: ${name}`} size="sm" color="gray" />)}
        {highlightedCategoryNames.map((name) => <Token key={`highlight-${name}`} label={`Highlight: ${name}`} size="sm" color="yellow" />)}
        {configuration.highlightedDates.map((date) => <Token key={date} label={`Highlight: ${formatTransactionDate(date)}`} size="sm" color="yellow" />)}
      </HStack>
    </VStack>
  );
}
