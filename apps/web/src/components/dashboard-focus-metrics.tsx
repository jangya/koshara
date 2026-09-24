import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

import {dashboardFocusMetrics, type DashboardModule, type HouseholdFinancialState} from '@/lib/dashboard-personalization';

export function DashboardFocusMetrics({financial, hero}: {financial: HouseholdFinancialState; hero: DashboardModule}) {
  return <Grid columns={{minWidth: 220, max: 2, repeat: 'fit'}} gap={4}>
    {dashboardFocusMetrics(financial, hero).map((metric) => <Card key={metric.label} padding={4} elevation="low"><VStack gap={2}>
      <Text type="supporting" color="secondary">{metric.label}</Text>
      <Text type="display-3" hasTabularNumbers>{metric.value}</Text>
      <Text type="supporting" color="secondary">{metric.description}</Text>
    </VStack></Card>)}
  </Grid>;
}
