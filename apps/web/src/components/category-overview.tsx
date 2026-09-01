import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

import {formatMinorCurrencySummary} from '@/lib/format';

interface CategoryOverviewFacts {
  totalCategorizedSpendingMinor: number;
  activeCategoryCount: number;
  overBudgetCount: number;
  nearBudgetCount: number;
  uncategorizedAmountMinor: number;
  uncategorizedCount: number;
  categoriesWithoutBudgetCount: number;
}

export function CategoryOverview({overview, period}: {overview: CategoryOverviewFacts; period: string}) {
  const metrics = [
    {label: 'Categorized spending', value: formatMinorCurrencySummary(overview.totalCategorizedSpendingMinor, 'INR'), supporting: period},
    {label: 'Categories with activity', value: new Intl.NumberFormat('en-IN').format(overview.activeCategoryCount), supporting: 'Ordinary spending categories'},
    {label: 'Budget attention', value: `${overview.overBudgetCount} over`, supporting: `${overview.nearBudgetCount} near limit`},
    {label: 'Uncategorized', value: formatMinorCurrencySummary(overview.uncategorizedAmountMinor, 'INR'), supporting: `${overview.uncategorizedCount} ${overview.uncategorizedCount === 1 ? 'transaction' : 'transactions'}`},
    {label: 'Needs a budget', value: new Intl.NumberFormat('en-IN').format(overview.categoriesWithoutBudgetCount), supporting: 'Eligible categories without limits'},
    {label: 'Active period', value: period, supporting: 'All figures use this exact range'},
  ];
  return (
    <Grid columns={{minWidth: 240, max: 3, repeat: 'fit'}} gap={3}>
      {metrics.map((metric) => (
        <Card key={metric.label} padding={4} minHeight="calc(var(--spacing-12) * 2)">
          <VStack gap={1}>
            <Text type="supporting" color="secondary">{metric.label}</Text>
            <Text type="display-3" hasTabularNumbers>{metric.value}</Text>
            <Text type="supporting" color="secondary">{metric.supporting}</Text>
          </VStack>
        </Card>
      ))}
    </Grid>
  );
}
