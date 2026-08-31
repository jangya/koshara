'use client';

import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {useId, useState} from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

import {formatMinorCurrencySummary} from '@/lib/format';
import type {TimelinePoint} from '@/lib/date-range';

type ChartMode = 'combined' | 'spending' | 'income';

const chartTokens = {
  income: 'var(--color-accent)',
  spending: 'var(--color-text-primary)',
  grid: 'var(--color-border)',
  axis: 'var(--color-text-secondary)',
} as const;

function axisCurrency(value: number) {
  return formatMinorCurrencySummary(value, 'INR');
}

function CashFlowTooltip({active, payload}: TooltipContentProps) {
  const point = payload[0]?.payload as TimelinePoint | undefined;
  if (!active || !point) return null;
  return (
    <Section padding={3} variant="muted">
      <VStack gap={2} minHeight="var(--spacing-12)">
        <Text type="supporting" color="secondary">{point.label}</Text>
        <HStack gap={4} vAlign="center">
          <StackItem size="fill"><Text>Income</Text></StackItem>
          <Text hasTabularNumbers>{formatMinorCurrencySummary(point.incomeMinor, 'INR')}</Text>
        </HStack>
        <HStack gap={4} vAlign="center">
          <StackItem size="fill"><Text>Spending</Text></StackItem>
          <Text hasTabularNumbers>{formatMinorCurrencySummary(point.spendingMinor, 'INR')}</Text>
        </HStack>
      </VStack>
    </Section>
  );
}

export function IncomeSpendingChart({points, period}: {points: TimelinePoint[]; period: string}) {
  const [mode, setMode] = useState<ChartMode>('combined');
  const isMobile = useMediaQuery('(max-width: 48rem)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const gradientId = useId().replaceAll(':', '');
  const totalIncome = points.reduce((sum, point) => sum + point.incomeMinor, 0);
  const totalSpending = points.reduce((sum, point) => sum + point.spendingMinor, 0);
  const hasActivity = totalIncome > 0 || totalSpending > 0;
  const hasScaleImbalance = Math.max(...points.map(({incomeMinor}) => incomeMinor), 0)
    > Math.max(...points.map(({spendingMinor}) => spendingMinor), 1) * 4;
  const summary = `${period}: income ${formatMinorCurrencySummary(totalIncome, 'INR')}; spending ${formatMinorCurrencySummary(totalSpending, 'INR')}; net cash flow ${formatMinorCurrencySummary(totalIncome - totalSpending, 'INR')}.`;
  const showsIncome = mode !== 'spending';
  const showsSpending = mode !== 'income';

  return (
    <Section>
      <VStack gap={4}>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <StackItem size="fill">
            <VStack gap={1}>
              <Heading level={2}>Cash flow</Heading>
              <Text type="supporting" color="secondary">Daily income and spending for {period}</Text>
            </VStack>
          </StackItem>
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value as ChartMode)}
            label="Cash-flow chart view"
            size="sm"
          >
            <SegmentedControlItem value="combined" label="Combined" />
            <SegmentedControlItem value="spending" label="Spending" />
            <SegmentedControlItem value="income" label="Income" />
          </SegmentedControl>
        </HStack>
        <HStack gap={4} vAlign="center" wrap="wrap">
          <HStack gap={1} vAlign="center">
            <StatusDot label="Income series" variant="accent" />
            <Text type="supporting">Income</Text>
          </HStack>
          <HStack gap={1} vAlign="center">
            <StatusDot label="Spending series" variant="neutral" />
            <Text type="supporting">Spending</Text>
          </HStack>
          {mode === 'combined' && hasScaleImbalance ? (
            <Text type="supporting" color="secondary">Separate scales keep daily spending legible.</Text>
          ) : null}
        </HStack>
        {!hasActivity ? (
          <EmptyState title="No activity in this period" description="Choose a different date range or add a transaction." headingLevel={3} />
        ) : (
          <VStack className="dashboard-cash-flow-chart" width="100%">
            {/* ResponsiveContainer requires a parent with a defined size. Source: https://recharts.github.io/en-US/guide/sizes/ */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={points} accessibilityLayer>
                <defs>
                  <linearGradient id={`${gradientId}-income`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartTokens.income} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={chartTokens.income} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${gradientId}-spending`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartTokens.spending} stopOpacity={0.14} />
                    <stop offset="100%" stopColor={chartTokens.spending} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={chartTokens.grid} strokeDasharray="3 5" />
                <XAxis
                  dataKey="label"
                  tick={{fill: chartTokens.axis, fontSize: 'var(--font-size-xs)'}}
                  tickLine={false}
                  axisLine={false}
                  interval={isMobile ? Math.max(1, Math.ceil(points.length / 4)) : 'preserveStartEnd'}
                  minTickGap={isMobile ? 20 : 32}
                />
                {showsSpending ? (
                  <YAxis
                    yAxisId="spending"
                    width="auto"
                    tickFormatter={axisCurrency}
                    tick={{fill: chartTokens.axis, fontSize: 'var(--font-size-xs)'}}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 'auto']}
                  />
                ) : null}
                {showsIncome ? (
                  <YAxis
                    yAxisId="income"
                    orientation={mode === 'combined' ? 'right' : 'left'}
                    width="auto"
                    tickFormatter={axisCurrency}
                    tick={{fill: chartTokens.axis, fontSize: 'var(--font-size-xs)'}}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 'auto']}
                  />
                ) : null}
                <Tooltip
                  content={CashFlowTooltip}
                  cursor={{stroke: chartTokens.grid}}
                  wrapperClassName="dashboard-chart-tooltip"
                  isAnimationActive={!prefersReducedMotion}
                />
                {showsIncome ? (
                  <Area
                    type="monotone"
                    dataKey="incomeMinor"
                    name="Income"
                    yAxisId="income"
                    stroke={chartTokens.income}
                    strokeWidth={2}
                    fill={`url(#${gradientId}-income)`}
                    isAnimationActive={!prefersReducedMotion}
                    animationDuration={360}
                  />
                ) : null}
                {showsSpending ? (
                  <Area
                    type="monotone"
                    dataKey="spendingMinor"
                    name="Spending"
                    yAxisId="spending"
                    stroke={chartTokens.spending}
                    strokeWidth={2}
                    fill={`url(#${gradientId}-spending)`}
                    isAnimationActive={!prefersReducedMotion}
                    animationDuration={360}
                  />
                ) : null}
              </AreaChart>
            </ResponsiveContainer>
            <VisuallyHidden>{summary}</VisuallyHidden>
          </VStack>
        )}
      </VStack>
    </Section>
  );
}
