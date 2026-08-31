import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Link} from '@astryxdesign/core/Link';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Token, type TokenColor} from '@astryxdesign/core/Token';

import type {CategoryAnalyticsRow} from '@/lib/category-analytics';
import type {DateRangePreset} from '@/lib/date-range';
import {formatMinorCurrencySummary} from '@/lib/format';
import {buildTransactionsHref} from '@/lib/transaction-view';
import type {DateRange} from '@astryxdesign/core/DateRangeInput';

function statusColor(status: CategoryAnalyticsRow['budgetStatus']): TokenColor {
  if (status?.label === 'Over budget') return 'red';
  if (status?.label === 'Near limit' || status?.label === 'Watch') return 'orange';
  return 'green';
}

function progressVariant(status: CategoryAnalyticsRow['budgetStatus']) {
  if (status?.label === 'Over budget') return 'error' as const;
  if (status?.label === 'Near limit' || status?.label === 'Watch') return 'warning' as const;
  return 'success' as const;
}

export function DashboardCategorySpending({
  rows,
  totalSpendingMinor,
  range,
  preset,
  period,
}: {
  rows: CategoryAnalyticsRow[];
  totalSpendingMinor: number;
  range: DateRange;
  preset: DateRangePreset;
  period: string;
}) {
  return (
    <Section height="100%">
      <VStack gap={4}>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <StackItem size="fill"><Heading level={2}>Spending by category</Heading></StackItem>
          <Link href={`/categories?from=${range.start}&to=${range.end}&range=${preset}`} isStandalone>Explore categories</Link>
        </HStack>
        {rows.length > 0 ? (
          <VStack as="ul" gap={1}>
            {rows.slice(0, 8).map((row) => {
              const share = totalSpendingMinor ? Math.round((row.spendingMinor / totalSpendingMinor) * 100) : 0;
              const progressMax = row.budgetLimitMinor ?? (totalSpendingMinor || 1);
              const progressContext = row.budgetLimitMinor === null
                ? `${share}% of categorized spending`
                : `${row.budgetStatus?.percent ?? 0}% of budget`;
              return (
                <Item
                  as="li"
                  key={row.category.id}
                  label={
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      <StackItem size="fill">
                        <Link href={buildTransactionsHref({range, preset, categoryId: row.category.id})} isStandalone>{row.category.name}</Link>
                      </StackItem>
                      {row.budgetStatus ? <Token label={row.budgetStatus.label} color={statusColor(row.budgetStatus)} size="sm" /> : null}
                    </HStack>
                  }
                  description={
                    <VStack gap={1}>
                      <Text type="supporting" color="secondary">{share}% of spending · {progressContext}</Text>
                      <ProgressBar
                        label={`${row.category.name}: ${progressContext}`}
                        value={row.spendingMinor}
                        max={progressMax}
                        isLabelHidden
                        variant={progressVariant(row.budgetStatus)}
                      />
                    </VStack>
                  }
                  endContent={<Text hasTabularNumbers>{formatMinorCurrencySummary(row.spendingMinor, 'INR')}</Text>}
                  density="balanced"
                  align="start"
                />
              );
            })}
          </VStack>
        ) : (
          <EmptyState title="No category spending" description={`No categorized expenses were recorded in ${period}.`} headingLevel={3} />
        )}
      </VStack>
    </Section>
  );
}
