import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';

import {formatMinorCurrencySummary} from '@/lib/format';
import type {TimelinePoint} from '@/lib/date-range';

const CHART_WIDTH = 800;
const CHART_HEIGHT = 220;
const PLOT_LEFT = 40;
const PLOT_TOP = 20;
const PLOT_WIDTH = 736;
const PLOT_HEIGHT = 160;

function pointCoordinates(points: TimelinePoint[], value: (point: TimelinePoint) => number, max: number) {
  return points.map((point, index) => {
    const x = PLOT_LEFT + (points.length === 1 ? PLOT_WIDTH / 2 : (index / (points.length - 1)) * PLOT_WIDTH);
    const y = PLOT_TOP + PLOT_HEIGHT - (value(point) / max) * PLOT_HEIGHT;
    return {point, x, y};
  });
}

export function IncomeSpendingChart({points, period}: {points: TimelinePoint[]; period: string}) {
  const totalIncome = points.reduce((sum, point) => sum + point.incomeMinor, 0);
  const totalSpending = points.reduce((sum, point) => sum + point.spendingMinor, 0);
  const max = Math.max(1, ...points.flatMap((point) => [point.incomeMinor, point.spendingMinor]));
  const incomePoints = pointCoordinates(points, (point) => point.incomeMinor, max);
  const spendingPoints = pointCoordinates(points, (point) => point.spendingMinor, max);
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const summary = `${period}: income ${formatMinorCurrencySummary(totalIncome, 'INR')}; spending ${formatMinorCurrencySummary(totalSpending, 'INR')}; net cash flow ${formatMinorCurrencySummary(totalIncome - totalSpending, 'INR')}.`;

  return (
    <Section>
      <VStack gap={4}>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <StackItem size="fill"><Heading level={2}>Income and spending timeline</Heading></StackItem>
          <HStack gap={3} vAlign="center">
            <HStack gap={1} vAlign="center"><StatusDot label="Income series" variant="accent" /><Text type="supporting">Income</Text></HStack>
            <HStack gap={1} vAlign="center"><StatusDot label="Spending series" variant="neutral" /><Text type="supporting">Spending</Text></HStack>
          </HStack>
        </HStack>
        {totalIncome === 0 && totalSpending === 0 ? (
          <EmptyState title="No activity in this period" description="Choose a different date range or add a transaction." headingLevel={3} />
        ) : (
          <>
            <svg role="img" aria-labelledby="timeline-title timeline-description" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%">
              <title id="timeline-title">{`Income versus spending for ${period}`}</title>
              <desc id="timeline-description">{summary}</desc>
              {[0, 0.5, 1].map((position) => (
                <line
                  key={position}
                  x1={PLOT_LEFT}
                  y1={PLOT_TOP + PLOT_HEIGHT * position}
                  x2={PLOT_LEFT + PLOT_WIDTH}
                  y2={PLOT_TOP + PLOT_HEIGHT * position}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
              ))}
              <polyline
                points={incomePoints.map(({x, y}) => `${x},${y}`).join(' ')}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <polyline
                points={spendingPoints.map(({x, y}) => `${x},${y}`).join(' ')}
                fill="none"
                stroke="var(--color-text-primary)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {incomePoints.map(({point, x, y}) => (
                <circle key={`income-${point.key}`} cx={x} cy={y} r="4" fill="var(--color-accent)">
                  <title>{`${point.label}: income ${formatMinorCurrencySummary(point.incomeMinor, 'INR')}`}</title>
                </circle>
              ))}
              {spendingPoints.map(({point, x, y}) => (
                <circle key={`spending-${point.key}`} cx={x} cy={y} r="4" fill="var(--color-text-primary)">
                  <title>{`${point.label}: spending ${formatMinorCurrencySummary(point.spendingMinor, 'INR')}`}</title>
                </circle>
              ))}
              {points.map((point, index) => index % labelEvery === 0 || index === points.length - 1 ? (
                <text
                  key={`label-${point.key}`}
                  x={PLOT_LEFT + (points.length === 1 ? PLOT_WIDTH / 2 : (index / (points.length - 1)) * PLOT_WIDTH)}
                  y={CHART_HEIGHT - 8}
                  textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                  fill="var(--color-text-primary)"
                  fontSize="var(--font-size-xs)"
                >
                  {point.label}
                </text>
              ) : null)}
            </svg>
            <VisuallyHidden>{summary}</VisuallyHidden>
          </>
        )}
      </VStack>
    </Section>
  );
}
