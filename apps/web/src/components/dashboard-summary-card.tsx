'use client';

import {Card} from '@astryxdesign/core/Card';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {useEffect, useRef, useState} from 'react';

import type {DashboardMetric} from '@/lib/dashboard-insights';
import {formatMinorCurrencySummary} from '@/lib/format';

const metricAnimationDurationMs = 360;

function comparisonCopy(metric: DashboardMetric, previousPeriod: string) {
  const {comparison} = metric;
  if (comparison.direction === 'unchanged') return `Unchanged from ${previousPeriod}`;
  if (comparison.direction === 'new') return `New activity compared with ${previousPeriod}`;
  return `${comparison.percent}% ${comparison.direction} than ${previousPeriod}`;
}

function useAnimatedMetric(value: number) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const previousValue = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const startValue = previousValue.current;
    previousValue.current = value;
    if (startValue === value || prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    let startedAt = 0;
    function animate(timestamp: number) {
      if (!startedAt) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / metricAnimationDurationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(Math.round(startValue + (value - startValue) * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [prefersReducedMotion, value]);

  return displayValue;
}

export function DashboardSummaryCard({metric, previousPeriod}: {metric: DashboardMetric; previousPeriod: string}) {
  const displayValue = useAnimatedMetric(metric.value);
  const statusVariant = metric.sentiment === 'positive' ? 'success' : metric.sentiment === 'negative' ? 'warning' : 'neutral';
  const formattedValue = metric.key === 'transactions'
    ? new Intl.NumberFormat('en-IN').format(displayValue)
    : formatMinorCurrencySummary(displayValue, 'INR');

  return (
    <Card padding={4} elevation="low" height="100%">
      <VStack gap={2} key={`${metric.key}-${metric.value}`} className="dashboard-metric-refresh">
        <Text type="supporting" color="secondary">{metric.label}</Text>
        <Text type="display-3" hasTabularNumbers>{formattedValue}</Text>
        <HStack gap={1} vAlign="center">
          <StatusDot variant={statusVariant} label={`${metric.label} comparison is ${metric.sentiment}`} />
          <Text type="supporting" color="secondary">{comparisonCopy(metric, previousPeriod)}</Text>
        </HStack>
      </VStack>
    </Card>
  );
}
