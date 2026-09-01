'use client';

import type {DateRange} from '@astryxdesign/core/DateRangeInput';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {useEffect, useId, useMemo, useState, useSyncExternalStore} from 'react';
import {Area, AreaChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';

import {CashflowChartAgentState} from '@/components/cashflow-chart-agent-state';
import {CashFlowTooltip} from '@/components/cashflow-chart-tooltip';
import {
  buildCashflowChartViewModel,
  getCashflowChartConfiguration,
  resetCashflowChart,
  subscribeCashflowChart,
  type CashflowChartConfiguration,
  type CashflowChartMode,
} from '@/lib/cashflow-chart';
import {formatMinorCurrencyCompact, formatMinorCurrencySummary} from '@/lib/format';
import type {KosharaState} from '@/lib/koshara-types';

const chartTokens = {
  income: 'var(--color-accent)',
  incomePrevious: 'var(--color-border-blue)',
  spending: 'var(--color-text-primary)',
  spendingPrevious: 'var(--color-text-secondary)',
  highlight: 'var(--color-warning)',
  grid: 'var(--color-border)',
  axis: 'var(--color-text-secondary)',
} as const;

const groupingLabels = {daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly'} as const;

function axisCurrency(value: number) {
  return formatMinorCurrencyCompact(value, 'INR');
}

export function IncomeSpendingChart({state, range}: {state: KosharaState; range: DateRange}) {
  const configuration = useSyncExternalStore(subscribeCashflowChart, getCashflowChartConfiguration, () => null);
  const [manualSelection, setManualSelection] = useState<{
    configuration: CashflowChartConfiguration | null;
    mode: CashflowChartMode;
  } | null>(null);
  const mode = manualSelection?.configuration === configuration ? manualSelection.mode : configuration?.mode ?? 'combined';
  const view = useMemo(() => buildCashflowChartViewModel(state, range, configuration), [configuration, range, state]);
  const isMobile = useMediaQuery('(max-width: 48rem)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const gradientId = useId().replaceAll(':', '');
  const showsIncome = mode !== 'spending';
  const showsSpending = mode !== 'income';
  const hasComparison = configuration?.comparePreviousPeriod === true;
  const hasHighlightedCategories = view.highlightedCategoryNames.length > 0;
  const hasActivity = view.points.some((point) => point.incomeMinor > 0
    || point.spendingMinor > 0
    || (hasComparison && ((point.previousIncomeMinor ?? 0) > 0 || (point.previousSpendingMinor ?? 0) > 0)));
  const hasScaleImbalance = Math.max(...view.points.map(({incomeMinor}) => incomeMinor), 0)
    > Math.max(...view.points.map(({spendingMinor}) => spendingMinor), 1) * 4;
  const labels = useMemo(() => new Map(view.points.map(({key, label}) => [key, label])), [view.points]);
  const summary = `${view.period}: income ${formatMinorCurrencySummary(view.totalIncomeMinor, 'INR')}; spending ${formatMinorCurrencySummary(view.totalSpendingMinor, 'INR')}; net cash flow ${formatMinorCurrencySummary(view.totalIncomeMinor - view.totalSpendingMinor, 'INR')}.`;

  useEffect(() => () => resetCashflowChart(), []);

  const resetChart = () => {
    setManualSelection(null);
    resetCashflowChart();
  };

  return (
    <Section>
      <VStack gap={4}>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <StackItem size="fill">
            <VStack gap={1}>
              <Heading level={2}>{configuration?.insightTitle ?? 'Cash flow'}</Heading>
              <Text type="supporting" color="secondary">{groupingLabels[view.grouping]} income and spending · {view.period}</Text>
            </VStack>
          </StackItem>
          <SegmentedControl value={mode} onChange={(value) => setManualSelection({configuration, mode: value as CashflowChartMode})} label="Cash-flow chart view" size="sm">
            <SegmentedControlItem value="combined" label="Combined" />
            <SegmentedControlItem value="spending" label="Spending" />
            <SegmentedControlItem value="income" label="Income" />
          </SegmentedControl>
        </HStack>
        {configuration ? (
          <CashflowChartAgentState
            configuration={configuration}
            accountNames={view.accountNames}
            categoryNames={view.categoryNames}
            highlightedCategoryNames={view.highlightedCategoryNames}
            previousPeriod={view.previousPeriod}
            onReset={resetChart}
          />
        ) : null}
        <HStack gap={4} vAlign="center" wrap="wrap" aria-label="Chart legend">
          {showsIncome ? <HStack gap={1} vAlign="center"><StatusDot label="Income series" variant="accent" /><Text type="supporting">Income</Text></HStack> : null}
          {showsSpending ? <HStack gap={1} vAlign="center"><StatusDot label="Spending series" variant="neutral" /><Text type="supporting">Spending</Text></HStack> : null}
          {hasHighlightedCategories && showsSpending ? <HStack gap={1} vAlign="center"><StatusDot label="Highlighted categories series" variant="warning" /><Text type="supporting">Highlighted categories</Text></HStack> : null}
          {hasComparison ? <Text type="supporting" color="secondary">Dashed lines show {view.previousPeriod}.</Text> : null}
          {mode === 'combined' && hasScaleImbalance ? <Text type="supporting" color="secondary">Separate scales keep spending legible beside income spikes.</Text> : null}
        </HStack>
        {!hasActivity ? (
          <EmptyState title="No activity in this view" description="Reset the chart or choose a different date range or filter." headingLevel={3} />
        ) : (
          <VStack className="dashboard-cash-flow-chart" width="100%">
            {/* ResponsiveContainer requires a parent with a defined size. Source: https://recharts.github.io/en-US/guide/sizes/ */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={view.points} accessibilityLayer>
                <defs>
                  <linearGradient id={`${gradientId}-income`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartTokens.income} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={chartTokens.income} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`${gradientId}-spending`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartTokens.spending} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={chartTokens.spending} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={chartTokens.grid} strokeDasharray="var(--spacing-1) var(--spacing-1)" />
                <XAxis
                  dataKey="key"
                  tickFormatter={(key) => labels.get(String(key)) ?? String(key)}
                  tick={{fill: chartTokens.axis, fontSize: 'var(--font-size-xs)'}}
                  tickLine={false}
                  axisLine={false}
                  interval={isMobile ? Math.max(0, Math.ceil(view.points.length / 4) - 1) : 'preserveStartEnd'}
                  minTickGap={isMobile ? 20 : 32}
                />
                {showsSpending ? <YAxis yAxisId="spending" width="auto" tickFormatter={axisCurrency} tick={{fill: chartTokens.axis, fontSize: 'var(--font-size-xs)'}} tickLine={false} axisLine={false} domain={[0, 'auto']} allowDecimals={false} /> : null}
                {showsIncome ? <YAxis yAxisId="income" orientation={mode === 'combined' ? 'right' : 'left'} hide={isMobile && mode === 'combined'} width="auto" tickFormatter={axisCurrency} tick={{fill: chartTokens.axis, fontSize: 'var(--font-size-xs)'}} tickLine={false} axisLine={false} domain={[0, 'auto']} allowDecimals={false} /> : null}
                <Tooltip
                  content={(props) => <CashFlowTooltip {...props} mode={mode} comparePreviousPeriod={hasComparison} previousPeriod={view.previousPeriod} hasHighlightedCategories={hasHighlightedCategories} />}
                  cursor={{stroke: chartTokens.grid}}
                  wrapperClassName="dashboard-chart-tooltip"
                  isAnimationActive={!prefersReducedMotion}
                />
                {view.points.filter(({isDateHighlighted}) => isDateHighlighted).map(({key}) => <ReferenceLine key={key} x={key} stroke={chartTokens.highlight} strokeDasharray="var(--spacing-1) var(--spacing-1)" />)}
                {hasComparison && showsIncome ? <Line type="monotone" dataKey="previousIncomeMinor" name="Previous income" yAxisId="income" stroke={chartTokens.incomePrevious} strokeWidth={2} strokeDasharray="var(--spacing-1) var(--spacing-1)" dot={false} isAnimationActive={false} /> : null}
                {hasComparison && showsSpending ? <Line type="monotone" dataKey="previousSpendingMinor" name="Previous spending" yAxisId="spending" stroke={chartTokens.spendingPrevious} strokeWidth={2} strokeDasharray="var(--spacing-1) var(--spacing-1)" dot={false} isAnimationActive={false} /> : null}
                {showsIncome ? <Area type="monotone" dataKey="incomeMinor" name="Income" yAxisId="income" stroke={chartTokens.income} strokeWidth={2} fill={`url(#${gradientId}-income)`} dot={false} isAnimationActive={!prefersReducedMotion} animationDuration={360} /> : null}
                {showsSpending ? <Area type="monotone" dataKey="spendingMinor" name="Spending" yAxisId="spending" stroke={chartTokens.spending} strokeWidth={2} fill={`url(#${gradientId}-spending)`} dot={false} isAnimationActive={!prefersReducedMotion} animationDuration={360} /> : null}
                {showsSpending && hasHighlightedCategories ? <Line type="monotone" dataKey="highlightedSpendingMinor" name="Highlighted categories" yAxisId="spending" stroke={chartTokens.highlight} strokeWidth={2} dot={false} isAnimationActive={!prefersReducedMotion} animationDuration={360} /> : null}
              </AreaChart>
            </ResponsiveContainer>
            <VisuallyHidden as="div" aria-live="polite">{summary}</VisuallyHidden>
          </VStack>
        )}
      </VStack>
    </Section>
  );
}
