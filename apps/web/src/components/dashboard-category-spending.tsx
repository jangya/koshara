'use client';

import {Button} from '@astryxdesign/core/Button';
import type {DateRange} from '@astryxdesign/core/DateRangeInput';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {Item} from '@astryxdesign/core/Item';
import {Link} from '@astryxdesign/core/Link';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';
import {Token} from '@astryxdesign/core/Token';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {useEffect, useMemo, useSyncExternalStore} from 'react';
import {Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipContentProps} from 'recharts';

import {
  buildCategorySpendingChartViewModel,
  getCategorySpendingChartConfiguration,
  resetCategorySpendingChart,
  subscribeCategorySpendingChart,
} from '@/lib/category-spending-chart';
import type {DateRangePreset} from '@/lib/date-range';
import {formatMinorCurrencySummary} from '@/lib/format';
import type {KosharaState} from '@/lib/koshara-types';

function CategoryTooltip({active, payload, total}: TooltipContentProps & {total: number}) {
  const point = payload[0]?.payload as {name: string; value: number} | undefined;
  if (!active || !point) return null;
  const share = total ? Math.round((point.value / total) * 100) : 0;
  return (
    <Section padding={3} variant="muted">
      <VStack gap={1}>
        <Text type="label">{point.name}</Text>
        <Text hasTabularNumbers>{formatMinorCurrencySummary(point.value, 'INR')}</Text>
        <Text type="supporting" color="secondary">{share}% of spending</Text>
      </VStack>
    </Section>
  );
}

export function DashboardCategorySpending({state, range, preset}: {
  state: KosharaState;
  range: DateRange;
  preset: DateRangePreset;
}) {
  const configuration = useSyncExternalStore(
    subscribeCategorySpendingChart,
    getCategorySpendingChartConfiguration,
    () => null,
  );
  const view = useMemo(() => buildCategorySpendingChartViewModel(state, range, configuration), [configuration, range, state]);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const chartPreset = configuration ? 'custom' : preset;
  const hasHighlights = view.highlightedCategoryNames.length > 0;

  useEffect(() => () => resetCategorySpendingChart(), []);

  return (
    <Section height="100%">
      <VStack gap={4}>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <StackItem size="fill">
            <VStack gap={1}>
              <Heading level={2}>{configuration?.insightTitle ?? 'Spending by category'}</Heading>
              <Text type="supporting" color="secondary">Share of categorized spending · {view.period}</Text>
            </VStack>
          </StackItem>
          <Link href={`/categories?from=${view.range.start}&to=${view.range.end}&range=${chartPreset}`} isStandalone>Explore categories</Link>
        </HStack>
        {configuration ? (
          <VStack gap={2}>
            <HStack className="dashboard-agent-chart-update" gap={2} vAlign="center" wrap="wrap" role="status" aria-live="polite">
              <StatusDot variant="accent" label="Category chart updated by your agent" />
              <StackItem size="fill"><Text type="supporting" color="secondary">Updated by your agent</Text></StackItem>
              <Button label="Reset chart" variant="ghost" size="sm" onClick={resetCategorySpendingChart} />
            </HStack>
            <HStack gap={2} wrap="wrap" aria-label="Agent-applied category chart context">
              {view.accountNames.map((name) => <Token key={`account-${name}`} label={`Account: ${name}`} size="sm" color="gray" />)}
              {view.categoryNames.map((name) => <Token key={`filter-${name}`} label={`Filter: ${name}`} size="sm" color="gray" />)}
              {view.highlightedCategoryNames.map((name) => <Token key={`highlight-${name}`} label={`Highlight: ${name}`} size="sm" color="yellow" />)}
            </HStack>
          </VStack>
        ) : null}
        {view.points.length > 0 ? (
          <Grid columns={{minWidth: 220, max: 2, repeat: 'fit'}} gap={4}>
            <VStack className="dashboard-category-pie-chart" width="100%">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart accessibilityLayer>
                  <Pie data={view.points} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={2} isAnimationActive={!prefersReducedMotion}>
                    {view.points.map((point) => (
                      <Cell
                        key={point.categoryId}
                        fill={`var(--color-icon-${point.color})`}
                        stroke={point.isHighlighted ? 'var(--color-warning)' : 'var(--color-background-surface)'}
                        strokeWidth={point.isHighlighted ? 4 : 2}
                        opacity={hasHighlights && !point.isHighlighted ? 0.48 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={(props) => <CategoryTooltip {...props} total={view.totalSpendingMinor} />} wrapperClassName="dashboard-chart-tooltip" />
                </PieChart>
              </ResponsiveContainer>
            </VStack>
            <VStack gap={2}>
              <Text type="supporting" color="secondary">Total · {formatMinorCurrencySummary(view.totalSpendingMinor, 'INR')}</Text>
              <VStack as="ul" gap={0}>
                {view.points.map((point) => {
                  const share = view.totalSpendingMinor ? Math.round((point.value / view.totalSpendingMinor) * 100) : 0;
                  return (
                    <Item
                      as="li"
                      key={point.categoryId}
                      label={<Token label={point.name} color={point.color} size="sm" />}
                      description={`${share}% of spending${point.budgetStatus ? ` · ${point.budgetStatus.label}` : ''}`}
                      endContent={<Text hasTabularNumbers>{formatMinorCurrencySummary(point.value, 'INR')}</Text>}
                      density="compact"
                    />
                  );
                })}
              </VStack>
            </VStack>
          </Grid>
        ) : (
          <EmptyState title="No category spending" description={`No categorized expenses were recorded in ${view.period}.`} headingLevel={3} />
        )}
      </VStack>
    </Section>
  );
}
