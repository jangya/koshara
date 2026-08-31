import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {VisuallyHidden} from '@astryxdesign/core/VisuallyHidden';

import {formatMinorCurrencySummary} from '@/lib/format';
import type {CategoryTrendPoint} from '@/lib/category-analytics';

const levels = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export function CategoryTrend({points}: {points: CategoryTrendPoint[]}) {
  const maximum = Math.max(...points.map(({amountMinor}) => amountMinor), 1);
  const sparkline = points.map(({amountMinor}) => levels[Math.round((amountMinor / maximum) * (levels.length - 1))]).join('');
  const summary = points.map(({label, amountMinor}) => `${label}: ${formatMinorCurrencySummary(amountMinor, 'INR')}`).join(', ');
  return (
    <VStack gap={0}>
      <Text aria-hidden="true" hasTabularNumbers>{sparkline}</Text>
      <VisuallyHidden as="div"><Text as="div">{summary}</Text></VisuallyHidden>
    </VStack>
  );
}
