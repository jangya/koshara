import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import type {Metadata} from 'next';

import {Page} from '@/components/page';
import {getHouseholdPageContext} from '@/lib/page-access';

export const metadata: Metadata = {title: 'Dashboard'};

const metrics = [
  {label: 'Total expenses', value: '₹0'},
  {label: 'Average daily spending', value: '₹0'},
  {label: 'Largest category', value: '—'},
  {label: 'Needs review', value: '0'},
] as const;

export default async function DashboardPage() {
  await getHouseholdPageContext();
  return (
    <Page title="Dashboard" description="A real household view will appear as statements are reviewed and committed.">
      <VStack gap={5}>
        <Grid columns={{minWidth: 220, max: 4, repeat: 'fit'}} gap={4}>
          {metrics.map((metric) => (
            <Card key={metric.label} padding={4}>
              <VStack gap={2}>
                <Text type="supporting" color="secondary">{metric.label}</Text>
                <Heading level={2} type="display-3">{metric.value}</Heading>
              </VStack>
            </Card>
          ))}
        </Grid>
        <Section padding={6} minHeight="20rem">
          <EmptyState
            title="No household expenses yet"
            description="Create an account first. CSV import and review arrive in Milestone 2; no sample transactions are shown."
            headingLevel={2}
          />
        </Section>
      </VStack>
    </Page>
  );
}
